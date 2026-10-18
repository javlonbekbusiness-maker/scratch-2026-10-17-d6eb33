import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { kv } from './kv';
import { rateLimit } from './rate-limit';
import { sendMessage } from './notify';

const OTP_TTL = 300;
const RESEND_AFTER = 60;
const MAX_ATTEMPTS = 5;

function hash(phone: string, code: string) {
  return createHash('sha256').update(`${phone}:${code}:${process.env.SESSION_SECRET ?? 'dev'}`).digest();
}

export type SendOtpResult =
  | { ok: true; resendIn: number; devCode?: string }
  | { ok: false; error: 'too_many'; retryAfter: number };

export async function sendOtp(phone: string, ip: string, lang: string): Promise<SendOtpResult> {
  const cooldown = await kv.ttl(`otp:cd:${phone}`);
  if (cooldown > 0) return { ok: false, error: 'too_many', retryAfter: cooldown };

  for (const [key, limit, win] of [
    [`otp:phone:${phone}`, 5, 3600],
    [`otp:ip:${ip}`, 20, 3600],
  ] as const) {
    const r = await rateLimit(key, limit, win);
    if (!r.ok) return { ok: false, error: 'too_many', retryAfter: r.retryAfter };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await kv.set(`otp:${phone}`, JSON.stringify({ h: hash(phone, code).toString('hex'), a: 0 }), OTP_TTL);
  await kv.set(`otp:cd:${phone}`, '1', RESEND_AFTER);
  await sendMessage({ key: 'OTP', channel: 'SMS', to: phone, lang, vars: { code } });

  const exposeCode = process.env.NODE_ENV !== 'production' && (process.env.SMS_PROVIDER ?? 'mock') === 'mock';
  return { ok: true, resendIn: RESEND_AFTER, ...(exposeCode ? { devCode: code } : {}) };
}

export type VerifyOtpResult = { ok: true } | { ok: false; error: 'invalid' | 'expired' | 'locked' };

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const lock = await rateLimit(`otp:verify:${phone}`, 15, 3600);
  if (!lock.ok) return { ok: false, error: 'locked' };

  const raw = await kv.get(`otp:${phone}`);
  if (!raw) return { ok: false, error: 'expired' };
  const rec = JSON.parse(raw) as { h: string; a: number };
  if (rec.a >= MAX_ATTEMPTS) {
    await kv.del(`otp:${phone}`);
    return { ok: false, error: 'locked' };
  }
  const expected = Buffer.from(rec.h, 'hex');
  const given = hash(phone, code.replace(/\D/g, ''));
  if (!timingSafeEqual(expected, given)) {
    rec.a += 1;
    const ttl = await kv.ttl(`otp:${phone}`);
    if (rec.a >= MAX_ATTEMPTS) await kv.del(`otp:${phone}`);
    else await kv.set(`otp:${phone}`, JSON.stringify(rec), Math.max(ttl, 1));
    return { ok: false, error: rec.a >= MAX_ATTEMPTS ? 'locked' : 'invalid' };
  }
  await kv.del(`otp:${phone}`);
  return { ok: true };
}
