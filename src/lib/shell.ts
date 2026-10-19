import { cache } from 'react';
import type { User } from '@prisma/client';
import { db } from './db';
import { dayKey } from './stats';
import { dueCount } from './srs';
import { getAccess } from './access';
import { activeCampaigns, welcomeOffer } from './pricing';

/** Consecutive Tashkent days with at least one answer, ending today or yesterday. One small query. */
export const getStreak = cache(async (userId: string) => {
  const rows = await db.$queryRaw<{ d: string }[]>`
    SELECT DISTINCT to_char(sa."createdAt" + interval '5 hours', 'YYYY-MM-DD') AS d
    FROM "SessionAnswer" sa JOIN "TestSession" ts ON ts.id = sa."sessionId"
    WHERE ts."userId" = ${userId} AND sa."createdAt" > now() - interval '400 days'`;
  const days = new Set(rows.map((r) => r.d));
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setTime(cursor.getTime() - 86400_000);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setTime(cursor.getTime() - 86400_000);
  }
  return streak;
});

/** The discount a signed-in, non-subscribed user can use right now (welcome offer first, then a seasonal sale). */
export const getActiveOffer = cache(async (user: User) => {
  const access = await getAccess(user.id);
  if (access.active) return null;
  try {
    const campaigns = await activeCampaigns();
    const w = await welcomeOffer(user, campaigns);
    if (w) return { kind: 'welcome' as const, pct: w.campaign.discountPct, endsAt: w.endsAt, campaign: w.campaign };
    const s = campaigns.find((c) => c.type === 'SEASONAL' && c.endsAt);
    if (s) return { kind: 'seasonal' as const, pct: s.discountPct, endsAt: s.endsAt!, campaign: s };
  } catch {
    // Pricing data unavailable: just don't show an offer.
  }
  return null;
});

export type ShellNotification = { id: string; kind: 'reviews' | 'offer' | 'expiry'; n?: number; date?: string; pct?: number; href: string };

/** Everything the top bar needs, computed from existing data (no notifications table). */
export const getShellData = cache(async (user: User) => {
  const [streak, due, access, offer] = await Promise.all([getStreak(user.id), dueCount(user.id), getAccess(user.id), getActiveOffer(user)]);
  const notes: ShellNotification[] = [];
  if (due > 0) notes.push({ id: 'reviews', kind: 'reviews', n: due, href: '/tests' });
  if (offer) notes.push({ id: 'offer', kind: 'offer', pct: offer.pct, date: offer.endsAt.toISOString(), href: '/pricing' });
  if (access.active && access.expiresAt && access.expiresAt.getTime() - Date.now() < 3 * 86400_000) {
    notes.push({ id: 'expiry', kind: 'expiry', date: access.expiresAt.toISOString(), href: '/pricing' });
  }
  return { streak, due, notes };
});
