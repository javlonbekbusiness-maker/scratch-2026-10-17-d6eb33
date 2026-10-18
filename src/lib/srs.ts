import { db } from './db';

/** Days until next review for boxes 1–5. Correct in box 5 = mastered. */
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

export async function recordReview(userId: string, questionId: string, correct: boolean) {
  const key = { userId_questionId: { userId, questionId } };
  if (!correct) {
    // Due immediately: "Mistakes review" should offer a question right after it was missed.
    await db.reviewItem.upsert({
      where: key,
      create: { userId, questionId, box: 1, dueAt: new Date(), lapses: 1 },
      update: { box: 1, dueAt: new Date(), lapses: { increment: 1 } },
    });
    return;
  }
  const item = await db.reviewItem.findUnique({ where: key });
  if (!item) return;
  const box = item.box + 1;
  if (box > 5) await db.reviewItem.delete({ where: key });
  else await db.reviewItem.update({ where: key, data: { box, dueAt: new Date(Date.now() + INTERVAL_DAYS[box] * 86400_000) } });
}

export function dueCount(userId: string) {
  return db.reviewItem.count({ where: { userId, dueAt: { lte: new Date() } } });
}
