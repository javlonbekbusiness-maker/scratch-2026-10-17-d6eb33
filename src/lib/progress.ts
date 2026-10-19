import { db } from './db';

export type Progress = { answered: number; mastered: number; correct: number; attempts: number; accuracy: number | null };

/**
 * The user's progress per ticket number or per topic within a category:
 * distinct questions answered / answered correctly at least once, and overall accuracy.
 */
export async function progressBy(userId: string, categoryId: string, key: 'ticketNumber' | 'topicId') {
  const answers = await db.sessionAnswer.findMany({
    where: { session: { userId }, question: { categoryId } },
    select: { questionId: true, isCorrect: true, question: { select: { ticketNumber: true, topicId: true } } },
  });
  const acc = new Map<string, { answered: Set<string>; mastered: Set<string>; correct: number; attempts: number }>();
  for (const a of answers) {
    const k = a.question[key];
    if (k === null || k === undefined) continue;
    const id = String(k);
    const s = acc.get(id) ?? { answered: new Set(), mastered: new Set(), correct: 0, attempts: 0 };
    s.answered.add(a.questionId);
    if (a.isCorrect) {
      s.mastered.add(a.questionId);
      s.correct++;
    }
    s.attempts++;
    acc.set(id, s);
  }
  const out = new Map<string, Progress>();
  for (const [id, s] of acc) {
    out.set(id, { answered: s.answered.size, mastered: s.mastered.size, correct: s.correct, attempts: s.attempts, accuracy: s.attempts ? Math.round((100 * s.correct) / s.attempts) : null });
  }
  return out;
}
