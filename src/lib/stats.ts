import { db } from './db';
import { MIN_ANSWERS, WEAK_ACCURACY, type TopicStat } from './adaptive';

/** Calendar days in Tashkent time (UTC+5, no DST). */
export const dayKey = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);

export type { TopicStat };

export async function userStats(userId: string, categoryId: string | null) {
  const answers = await db.sessionAnswer.findMany({
    where: { session: { userId } },
    select: { isCorrect: true, createdAt: true, questionId: true, question: { select: { topicId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const total = answers.length;
  const correct = answers.filter((a) => a.isCorrect).length;
  const recent = answers.slice(0, 200);
  const recentAcc = recent.length ? recent.filter((a) => a.isCorrect).length / recent.length : 0;

  const bankSize = categoryId ? await db.question.count({ where: { categoryId, isActive: true } }) : 0;
  const mastered = new Set(answers.filter((a) => a.isCorrect).map((a) => a.questionId)).size;
  const coverage = bankSize ? Math.min(1, mastered / bankSize) : 0;
  const readiness = Math.round(100 * (0.6 * recentAcc + 0.4 * coverage));

  const byTopic = new Map<string, TopicStat>();
  for (const a of answers) {
    const t = a.question.topicId;
    if (!t) continue;
    const s = byTopic.get(t) ?? { topicId: t, correct: 0, total: 0, accuracy: 0 };
    s.total++;
    if (a.isCorrect) s.correct++;
    byTopic.set(t, s);
  }
  const topics = [...byTopic.values()].map((s) => ({ ...s, accuracy: Math.round((100 * s.correct) / s.total) }));
  const weak = topics.filter((s) => s.total >= MIN_ANSWERS && s.accuracy < WEAK_ACCURACY).sort((a, b) => a.accuracy - b.accuracy);

  const perDay = new Map<string, number>();
  for (const a of answers) {
    const k = dayKey(a.createdAt);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }

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
