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

/**
 * The client's IP as seen by our own reverse proxy. Entries at the start of X-Forwarded-For are
 * whatever the client sent, so we count TRUSTED_PROXY_HOPS (default 1) entries back from the end,
 * where each trusted proxy appends the address it received the request from.
 */
export async function clientIp() {
  const h = await headers();
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  const chain = (h.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - hops] || chain[0] || h.get('x-real-ip') || 'unknown';
}
