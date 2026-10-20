import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { notifyUser } from '@/lib/notify';
import { userStats } from '@/lib/stats';
import { formatDate } from '@/lib/format';
import type { TemplateKey } from '@/lib/template-defaults';

/**
 * Run hourly from any scheduler:  curl -H "Authorization: Bearer $CRON_SECRET" https://host/api/cron/reminders
 * Access expiry itself needs no job: access is computed from Subscription.expiresAt.
 */
const H = 3600_000;

async function recentlySent(userId: string, key: TemplateKey, withinMs: number) {
  return (await db.messageLog.count({ where: { userId, key, createdAt: { gt: new Date(Date.now() - withinMs) } } })) > 0;
}

async function singleUseCode(prefix: string, pct: number, days: number, note: string) {
  const code = `${prefix}${randomBytes(3).toString('hex').toUpperCase()}`;
  await db.promoCode.create({
    data: { code, type: 'PERCENT', value: pct, usageLimit: 1, perUserLimit: 1, endsAt: new Date(Date.now() + days * 86400_000), note },
  });
  return code;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const now = Date.now();
  const sent = { expiry: 0, streak: 0, abandoned: 0, winback: 0 };

  // Subscription ends within 48h and nothing newer is queued.
  const expiring = await db.subscription.findMany({
    where: { expiresAt: { gt: new Date(now), lt: new Date(now + 48 * H) } },
    include: { user: true },
  });
  for (const s of expiring) {
    const later = await db.subscription.count({ where: { userId: s.userId, expiresAt: { gt: s.expiresAt } } });
    if (later || (await recentlySent(s.userId, 'EXPIRY', 72 * H))) continue;
    await notifyUser(s.user, 'EXPIRY', { name: s.user.name ?? '', expiry_date: formatDate(s.expiresAt) });
    sent.expiry++;
  }

  // Studied yesterday but not yet today → nudge to keep the streak.
  const streakers = await db.user.findMany({ where: { lastActiveAt: { gt: new Date(now - 48 * H), lt: new Date(now - 20 * H) } }, take: 500 });
  for (const u of streakers) {
    if (await recentlySent(u.id, 'STREAK', 20 * H)) continue;
    const { streak } = await userStats(u.id);
    if (streak < 2) continue;
    await notifyUser(u, 'STREAK', { name: u.name ?? '', streak });
    sent.streak++;
  }

  // Checkout started 1–24h ago and never completed.
  const abandoned = await db.payment.findMany({
    where: { status: 'PENDING', createdAt: { gt: new Date(now - 24 * H), lt: new Date(now - H) } },
    include: { user: true, plan: true },
    distinct: ['userId'],
  });
  for (const p of abandoned) {
    const paid = await db.payment.count({ where: { userId: p.userId, status: 'PAID', createdAt: { gt: p.createdAt } } });
    if (paid || (await recentlySent(p.userId, 'ABANDONED', 7 * 24 * H))) continue;
    const code = await singleUseCode('BACK', 10, 3, `abandoned:${p.userId}`);
    await notifyUser(p.user, 'ABANDONED', { name: p.user.name ?? '', plan: p.plan.labelUz, promo_code: code });
    sent.abandoned++;
  }

  // Access lapsed 7–30 days ago, no active subscription.
  const winbackPct = (await db.campaign.findFirst({ where: { type: 'WINBACK', isActive: true } }))?.discountPct ?? 20;
  const lapsed = await db.subscription.findMany({
    where: { expiresAt: { gt: new Date(now - 30 * 24 * H), lt: new Date(now - 7 * 24 * H) } },
    include: { user: true },
    distinct: ['userId'],
  });
  for (const s of lapsed) {
    if (s.user.passedAt) continue;
    const active = await db.subscription.count({ where: { userId: s.userId, expiresAt: { gt: new Date() } } });
    if (active || (await recentlySent(s.userId, 'WINBACK', 30 * 24 * H))) continue;
    const code = await singleUseCode('WIN', winbackPct, 7, `winback:${s.userId}`);
    await notifyUser(s.user, 'WINBACK', { name: s.user.name ?? '', promo_code: code });
    sent.winback++;
  }

  return NextResponse.json({ ok: true, sent });
}
