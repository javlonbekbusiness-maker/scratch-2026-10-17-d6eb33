import { cache } from 'react';
import { db } from './db';

/** A question needs at least this many answers (from all users) before its miss rate counts. */
export const TRICKY_MIN_ANSWERS = 3;
/** …and at least this share of wrong answers. */
export const TRICKY_MIN_WRONG_RATE = 0.35;

/**
 * "Qopqonli savollar": questions admins flagged as traps, plus the ones users miss most often.
 * Real data only — no question is listed just to fill the page.
 */
export const getTrickyQuestions = cache(async (categoryId: string, limit = 60) => {
  const [flagged, missed] = await Promise.all([
    db.question.findMany({ where: { categoryId, isActive: true, isTricky: true }, select: { id: true } }),
    db.$queryRaw<{ questionId: string; total: number; wrong: number }[]>`
      SELECT sa."questionId", count(*)::int AS total, sum(CASE WHEN sa."isCorrect" THEN 0 ELSE 1 END)::int AS wrong
      FROM "SessionAnswer" sa JOIN "Question" q ON q.id = sa."questionId"
      WHERE q."categoryId" = ${categoryId} AND q."isActive" = true
      GROUP BY sa."questionId"
      HAVING count(*) >= ${TRICKY_MIN_ANSWERS}
        AND sum(CASE WHEN sa."isCorrect" THEN 0 ELSE 1 END)::float / count(*) >= ${TRICKY_MIN_WRONG_RATE}
      ORDER BY sum(CASE WHEN sa."isCorrect" THEN 0 ELSE 1 END)::float / count(*) DESC, count(*) DESC
      LIMIT ${limit}`,
  ]);
  const rate = new Map(missed.map((m) => [m.questionId, Math.round((100 * m.wrong) / m.total)]));
  const ids = [...new Set([...flagged.map((f) => f.id), ...missed.map((m) => m.questionId)])].slice(0, limit);
  return { ids, flagged: flagged.length, missRate: rate };
});
