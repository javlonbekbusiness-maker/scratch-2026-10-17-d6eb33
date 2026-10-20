import { Prisma } from '@prisma/client';
import { db } from './db';
import { MIN_ANSWERS, WEAK_ACCURACY, type TopicStat } from './adaptive';

/** Calendar days in Tashkent time (UTC+5, no DST). */
export const dayKey = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

export type { TopicStat };

/** Considers the user's latest 5000 answers, aggregated in SQL (fast for users with long histories). */
const HISTORY = 5000;

export async function userStats(userId: string) {
  const recentAnswers = Prisma.sql`
    SELECT sa."questionId", sa."isCorrect", sa."createdAt", q."topicId"
    FROM "SessionAnswer" sa
    JOIN "TestSession" s ON s.id = sa."sessionId"
    JOIN "Question" q ON q.id = sa."questionId"
    WHERE s."userId" = ${userId}
    ORDER BY sa."createdAt" DESC
    LIMIT ${HISTORY}`;
  const [[totals], topicRows, dayRows, bankSize] = await Promise.all([
    db.$queryRaw<{ total: number; correct: number; mastered: number; recentTotal: number; recentCorrect: number }[]>`
      WITH a AS (${recentAnswers}), r AS (SELECT * FROM a ORDER BY "createdAt" DESC LIMIT 200)
      SELECT (SELECT count(*) FROM a)::int AS total,
             (SELECT count(*) FROM a WHERE "isCorrect")::int AS correct,
             (SELECT count(DISTINCT "questionId") FROM a WHERE "isCorrect")::int AS mastered,
             (SELECT count(*) FROM r)::int AS "recentTotal",
             (SELECT count(*) FROM r WHERE "isCorrect")::int AS "recentCorrect"`,
    db.$queryRaw<{ topicId: string; total: number; correct: number }[]>`
      WITH a AS (${recentAnswers})
      SELECT "topicId", count(*)::int AS total, count(*) FILTER (WHERE "isCorrect")::int AS correct
      FROM a WHERE "topicId" IS NOT NULL GROUP BY "topicId"`,
    db.$queryRaw<{ day: string; count: number }[]>`
      WITH a AS (${recentAnswers})
      SELECT to_char("createdAt" + interval '5 hours', 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM a GROUP BY 1`,
    db.question.count({ where: { isActive: true } }),
  ]);

  const { total, correct, mastered } = totals;
  const recentAcc = totals.recentTotal ? totals.recentCorrect / totals.recentTotal : 0;
  const coverage = bankSize ? Math.min(1, mastered / bankSize) : 0;
  const readiness = Math.round(100 * (0.6 * recentAcc + 0.4 * coverage));

  const topics: TopicStat[] = topicRows.map((s) => ({ topicId: s.topicId, correct: s.correct, total: s.total, accuracy: Math.round((100 * s.correct) / s.total) }));
  const weak = topics.filter((s) => s.total >= MIN_ANSWERS && s.accuracy < WEAK_ACCURACY).sort((a, b) => a.accuracy - b.accuracy);

  const perDay = new Map(dayRows.map((r) => [r.day, r.count]));

  let streak = 0;
  const cursor = new Date();
  if (!perDay.has(dayKey(cursor))) cursor.setTime(cursor.getTime() - 86400_000);
  while (perDay.has(dayKey(cursor))) {
    streak++;
    cursor.setTime(cursor.getTime() - 86400_000);
  }

  const heatmap: { day: string; count: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const k = dayKey(new Date(Date.now() - i * 86400_000));
    heatmap.push({ day: k, count: perDay.get(k) ?? 0 });
  }

  return {
    total,
    correct,
    accuracy: total ? Math.round((100 * correct) / total) : 0,
    readiness,
    coverage: Math.round(coverage * 100),
    topics,
    weak,
    streak,
    heatmap,
  };
}
