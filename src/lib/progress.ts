import { Prisma } from '@prisma/client';
import { db } from './db';

export type Progress = { answered: number; mastered: number; correct: number; attempts: number; accuracy: number | null };

/**
 * The user's progress per ticket number or per topic over the shared pool:
 * distinct questions answered / answered correctly at least once, and overall accuracy.
 * Aggregated in SQL so it stays fast for users with thousands of answers.
 */
export async function progressBy(userId: string, key: 'ticketNumber' | 'topicId') {
  const col = key === 'ticketNumber' ? Prisma.sql`q."ticketNumber"::text` : Prisma.sql`q."topicId"`;
  const rows = await db.$queryRaw<{ k: string; answered: number; mastered: number; correct: number; attempts: number }[]>`
    SELECT ${col} AS k,
           count(DISTINCT sa."questionId")::int AS answered,
           count(DISTINCT sa."questionId") FILTER (WHERE sa."isCorrect")::int AS mastered,
           count(*) FILTER (WHERE sa."isCorrect")::int AS correct,
           count(*)::int AS attempts
    FROM "SessionAnswer" sa
    JOIN "TestSession" s ON s.id = sa."sessionId"
    JOIN "Question" q ON q.id = sa."questionId"
    WHERE s."userId" = ${userId} AND ${col} IS NOT NULL
    GROUP BY 1`;
  const out = new Map<string, Progress>();
  for (const r of rows) {
    out.set(r.k, { answered: r.answered, mastered: r.mastered, correct: r.correct, attempts: r.attempts, accuracy: r.attempts ? Math.round((100 * r.correct) / r.attempts) : null });
  }
  return out;
}
