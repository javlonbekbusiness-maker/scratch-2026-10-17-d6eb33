import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Daily limit on full tests (EXAM mode, always exactly FULL_TEST_QUESTIONS questions).
 * A test counts once it is finished and its result is saved (TestSession.finishedAt set),
 * on the calendar day of that moment in Asia/Tashkent. Practice modes are not limited.
 */
export const FULL_TEST_QUESTIONS = 20;
export const DAILY_FULL_TEST_LIMIT = 2;
export const LIMIT_TIME_ZONE = 'Asia/Tashkent';

const DAY_MS = 86_400_000;
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: LIMIT_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function zonedParts(at: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(at).map((x) => [x.type, Number(x.value)]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second };
}

/** [start, end) of the Asia/Tashkent calendar day containing `at`, as UTC instants. */
export function tashkentDayRange(at: Date = new Date()) {
  const z = zonedParts(at);
  // Offset of the zone at this instant (Tashkent is UTC+5 all year, no DST).
  const offsetMs = Date.UTC(z.y, z.m - 1, z.d, z.h, z.min, z.s) - Math.floor(at.getTime() / 1000) * 1000;
  const start = new Date(Date.UTC(z.y, z.m - 1, z.d) - offsetMs);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export type DailyStatus = { used: number; remaining: number; limit: number; resetsAt: Date };

type Client = PrismaClient | Prisma.TransactionClient;

/** Full tests the user has completed today (Tashkent), counted from saved results. */
export async function countFullTestsToday(client: Client, userId: string, now: Date = new Date()) {
  const { start, end } = tashkentDayRange(now);
  return client.testSession.count({
    where: { userId, mode: 'EXAM', totalQ: FULL_TEST_QUESTIONS, finishedAt: { gte: start, lt: end } },
  });
}

export function dailyStatus(used: number, now: Date = new Date()): DailyStatus {
  return {
    used,
    remaining: Math.max(0, DAILY_FULL_TEST_LIMIT - used),
    limit: DAILY_FULL_TEST_LIMIT,
    resetsAt: tashkentDayRange(now).end,
  };
}

export async function getDailyStatus(client: Client, userId: string, now: Date = new Date()) {
  return dailyStatus(await countFullTestsToday(client, userId, now), now);
}

/**
 * Serialises limit-sensitive work for one user until the surrounding transaction ends.
 * Concurrent finishes for the same user (other tabs, devices, retries) wait here, so the
 * count they read always includes results committed just before them.
 */
export async function lockUserForLimit(tx: Prisma.TransactionClient, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`full-test-limit:${userId}`}))`;
}
