/**
 * End-to-end auth checks against a running dev server (SMS_PROVIDER=mock).
 *   npm run dev            # in one terminal
 *   npm run test:e2e       # in another (BASE_URL defaults to http://localhost:3000)
 * Creates throwaway users with random +99899… numbers and deletes them afterwards.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const db = new PrismaClient();
const created: string[] = [];
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const randomPhone = () => `+99899${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;

/** Test IPs (TEST-NET-3) so each run gets fresh rate-limit buckets; the dev server has no proxy in front. */
const randomIp = () => `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
const RUN_IP = randomIp();

async function req(path: string, opts: { cookie?: string; method?: string; body?: unknown; ip?: string; xff?: string } = {}) {
  return fetch(BASE + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    redirect: 'manual',
    headers: {
      'X-Forwarded-For': opts.xff ?? opts.ip ?? RUN_IP,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.cookie ? { Cookie: `yhq_session=${opts.cookie}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}
const sessionToken = (r: Response) => /yhq_session=([^;]+)/.exec(r.headers.get('set-cookie') ?? '')?.[1];

/** Phone OTP sign-in; returns the session token. */
async function signIn(phone: string) {
  const sent = await req('/api/auth/send-otp', { body: { phone, consent: true } });
  assert.equal(sent.status, 200, 'send-otp');
  const { devCode } = await sent.json();
  assert.match(devCode, /^\d{6}$/, 'mock provider returns the dev code');
  const ok = await req('/api/auth/verify-otp', { body: { phone, code: devCode } });
  assert.equal(ok.status, 200);
  const token = sessionToken(ok);
  assert.ok(token, 'session cookie set');
  return token!;
}

/** A server-side redirect to /login, whether from middleware or from requireUser(). */
async function expectLoginRedirect(path: string, cookie?: string) {
  const r = await req(path, { cookie });
  assert.ok([302, 303, 307, 308].includes(r.status), `${path}: expected redirect, got ${r.status}`);
  assert.match(r.headers.get('location') ?? '', /\/login/, `${path} → login`);
}

after(async () => {
  if (created.length) await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

test('protected pages redirect anonymous visitors to /login', async () => {
  for (const p of ['/dashboard', '/profile', '/tests', '/checkout/sandbox/x', '/admin']) await expectLoginRedirect(p);
});

test('a forged session cookie is rejected on the server', async () => {
  await expectLoginRedirect('/profile', 'forged-token-value');
  const api = await req('/api/promo/quote', { cookie: 'forged-token-value', body: { planId: 'x' } });
  assert.equal(api.status, 401);
});

test('registration: input validation, wrong code, then success without duplicates', async () => {
  const bad = await req('/api/auth/send-otp', { body: { phone: '12345', consent: true } });
  assert.equal(bad.status, 400, 'invalid phone rejected');
  const noConsent = await req('/api/auth/send-otp', { body: { phone: randomPhone(), consent: false } });
  assert.equal(noConsent.status, 400, 'consent required');

  const phone = randomPhone();
  const sent = await req('/api/auth/send-otp', { body: { phone, consent: true } });
  const { devCode } = await sent.json();
  const wrong = await req('/api/auth/verify-otp', { body: { phone, code: devCode === '000000' ? '111111' : '000000' } });
  assert.equal(wrong.status, 400);
  assert.equal((await wrong.json()).error, 'invalid');
  assert.equal(sessionToken(wrong), undefined, 'no session on a wrong code');

  const ok = await req('/api/auth/verify-otp', { body: { phone, code: devCode } });
  assert.equal((await ok.json()).next, '/onboarding', 'new users go to onboarding');
  const user = await db.user.findUniqueOrThrow({ where: { phone } });
  created.push(user.id);

  const again = await req('/api/auth/send-otp', { body: { phone: phone.replace('+998', '') , consent: true } });
  assert.equal(again.status, 429, 'resend cooldown applies to the same (normalized) number');
  await assert.rejects(db.user.create({ data: { phone, referralCode: `DUP${Date.now()}` } }), 'phone is unique in the database');
  assert.equal(await db.user.count({ where: { phone } }), 1, 'no duplicate account');
  const stored = await db.authSession.findMany({ where: { userId: user.id } });
  assert.equal(stored.length, 1);
  assert.ok(stored.every((s) => /^[0-9a-f]{64}$/.test(s.tokenHash)), 'only token hashes are stored');
});

test('regular users get 404 on admin pages and admin APIs', async () => {
  const phone = randomPhone();
  const token = await signIn(phone);
  const u = await db.user.update({ where: { phone }, data: { name: 'E2E', onboarded: true } });
  created.push(u.id);

  assert.equal((await req('/profile', { cookie: token })).status, 200, 'own profile works');
  for (const p of ['/admin', '/admin/users', '/admin/payments', '/admin/settings', '/api/admin/export/users']) {
    assert.equal((await req(p, { cookie: token })).status, 404, `${p} hidden from users`);
  }
});

test('admins can open the admin panel', async () => {
  const phone = randomPhone();
  const token = await signIn(phone);
  const u = await db.user.update({ where: { phone }, data: { name: 'E2E admin', onboarded: true, role: 'ADMIN' } });
  created.push(u.id);
  for (const p of ['/admin', '/admin/users']) assert.equal((await req(p, { cookie: token })).status, 200, p);
});

test('expired sessions stop working and are deleted', async () => {
  const phone = randomPhone();
  const token = await signIn(phone);
  const u = await db.user.update({ where: { phone }, data: { name: 'E2E', onboarded: true } });
  created.push(u.id);
  assert.equal((await req('/dashboard', { cookie: token })).status, 200);

  await db.authSession.update({ where: { tokenHash: sha(token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await expectLoginRedirect('/dashboard', token);
  assert.equal(await db.authSession.count({ where: { tokenHash: sha(token) } }), 0, 'expired row removed');
});

test('email + password login: generic error, then success', async () => {
  const phone = randomPhone();
  const email = `e2e-${Date.now()}@example.test`;
  const u = await db.user.create({
    data: { phone, email, name: 'E2E', onboarded: true, passwordHash: await bcrypt.hash('correct-horse-1', 10), referralCode: `E2E${Date.now()}`.slice(0, 16) },
  });
  created.push(u.id);

  const wrong = await req('/api/auth/login-email', { body: { email, password: 'nope-nope' } });
  const unknown = await req('/api/auth/login-email', { body: { email: `missing-${email}`, password: 'nope-nope' } });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json(), 'same answer for wrong password and unknown email');

  const ok = await req('/api/auth/login-email', { body: { email: email.toUpperCase(), password: 'correct-horse-1' } });
  assert.equal(ok.status, 200, 'email is case-insensitive');
  const token = sessionToken(ok);
  assert.ok(token);
  assert.equal((await req('/profile', { cookie: token })).status, 200);
  const body = JSON.stringify(await (await req('/api/auth/login-email', { body: { email, password: 'correct-horse-1' } })).json());
  assert.ok(!/hash|token/i.test(body), 'response never contains hashes or tokens');
});

test('login rate limit: 10 attempts per IP, and a spoofed X-Forwarded-For prefix does not reset it', async () => {
  const ip = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
  const statuses: number[] = [];
  for (let i = 0; i < 11; i++) {
    // A different email each time, so only the per-IP limit can trigger; the first entry is attacker-chosen.
    const r = await req('/api/auth/login-email', { xff: `10.0.0.${i}, ${ip}`, body: { email: `rl-${i}-${Date.now()}@example.test`, password: 'x' } });
    statuses.push(r.status);
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
  assert.equal(statuses[10], 429, 'the 11th attempt from the same proxy-seen IP is blocked');
});
