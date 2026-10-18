import { headers } from 'next/headers';
import { kv } from './kv';

export async function rateLimit(key: string, limit: number, windowSec: number) {
  const k = `rl:${key}`;
  const n = await kv.incr(k, windowSec);
  if (n > limit) return { ok: false as const, retryAfter: Math.max(1, await kv.ttl(k)) };
  return { ok: true as const, retryAfter: 0 };
}

/** Check-then-count variant: only failures are recorded (via `recordFailure`). */
export async function failureLimited(key: string, limit: number) {
  const k = `rlf:${key}`;
  const n = Number((await kv.get(k)) ?? 0);
  return n >= limit ? { limited: true as const, retryAfter: Math.max(1, await kv.ttl(k)) } : { limited: false as const, retryAfter: 0 };
}

export async function recordFailure(key: string, windowSec: number) {
  await kv.incr(`rlf:${key}`, windowSec);
}

export async function clientIp() {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}
