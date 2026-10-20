import type { User } from '@prisma/client';
import { db } from './db';
import { getDailyStatus, tashkentDayRange } from './daily-limit';

/** Answers per day the home screen's goal bar aims for (a constant for now; could become a setting). */
export const DAILY_GOAL = 20;

/** The newest unfinished test that can still be continued (not timed out; full tests only while today's limit allows). */
export async function getResumeSession(user: User) {
  const open = await db.testSession.findMany({
    where: { userId: user.id, finishedAt: null },
    orderBy: { startedAt: 'desc' },
    take: 5,
    include: { _count: { select: { answers: true } } },
  });
  const now = Date.now();
  let examAllowed: boolean | null = null;
  for (const s of open) {
    if (s.timeLimitSec && now - s.startedAt.getTime() > s.timeLimitSec * 1000) continue;
    if (s._count.answers >= s.totalQ) continue;
    if (s.mode === 'EXAM') {
      examAllowed ??= (await getDailyStatus(db, user.id)).remaining > 0;
      if (!examAllowed) continue;
    }
    return { id: s.id, mode: s.mode, ticketNumber: s.ticketNumber, answered: s._count.answers, total: s.totalQ };
  }
  return null;
}

/** Questions answered today (Tashkent day) across all modes. */
export async function answersToday(userId: string) {
  const { start } = tashkentDayRange();
  return db.sessionAnswer.count({ where: { session: { userId }, createdAt: { gte: start } } });
}

/** Counts shown on the home cards. */
export async function homeCounts(user: User) {
  const [tickets, topics, reviewTotal] = await Promise.all([
    db.ticket.count(),
    db.topic.count({ where: { questions: { some: { isActive: true } } } }),
    db.reviewItem.count({ where: { userId: user.id } }),
  ]);
  return { tickets, topics, reviewTotal };
}
