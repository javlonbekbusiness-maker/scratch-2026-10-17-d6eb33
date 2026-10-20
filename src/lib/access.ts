import { cache } from 'react';
import { db } from './db';

export const getAccess = cache(async (userId: string) => {
  const sub = await db.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
    include: { plan: true },
  });
  return { active: !!sub, expiresAt: sub?.expiresAt ?? null, plan: sub?.plan ?? null };
});

/** New access starts when the current one ends, so purchases stack. */
export async function grantDays(userId: string, days: number, source: string, extra: { planId?: string; paymentId?: string } = {}) {
  const current = await db.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
  });
  const startsAt = current?.expiresAt ?? new Date();
  const expiresAt = new Date(startsAt.getTime() + days * 86400_000);
  return db.subscription.create({ data: { userId, source, startsAt, expiresAt, ...extra } });
}

export async function freeTicketNumbers() {
  const rows = await db.ticket.findMany({ where: { isFree: true }, select: { number: true } });
  return rows.map((r) => r.number);
}
