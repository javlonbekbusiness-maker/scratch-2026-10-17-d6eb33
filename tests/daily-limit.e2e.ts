/**
 * Daily full-test limit through the real HTTP API (run with `npm run test:e2e` against `npm run dev`,
 * SMS_PROVIDER=mock). Users sign in with the mock OTP; exam sessions are created directly in the
 * database the way startTest creates them. Throwaway users are deleted afterwards.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const RUN_IP = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
const db = new PrismaClient();
const created: string[] = [];

after(async () => {
  if (created.length) await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

async function post(path: string, body: unknown, cookie?: string) {
  return fetch(BASE + path, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': RUN_IP, ...(cookie ? { Cookie: `yhq_session=${cookie}; lang=uz` } : {}) },
    body: JSON.stringify(body),
  });
}
async function page(path: string, cookie: string) {
  return fetch(BASE + path, { redirect: 'manual', headers: { 'X-Forwarded-For': RUN_IP, Cookie: `yhq_session=${cookie}; lang=uz` } });
}

/** Signs a fresh user in through the mock OTP flow; returns its id and session token. */
async function newUser() {
  const phone = `+99897${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const sent = await post('/api/auth/send-otp', { phone, consent: true });
  assert.equal(sent.status, 200, 'send-otp');
  const { devCode } = await sent.json();
  const ok = await post('/api/auth/verify-otp', { phone, code: devCode });
  const token = /yhq_session=([^;]+)/.exec(ok.headers.get('set-cookie') ?? '')?.[1];
  assert.ok(token);
  const cat = await db.category.findFirstOrThrow({ where: { code: 'B' } });
  const u = await db.user.update({ where: { phone }, data: { name: 'Limit e2e', onboarded: true, categoryId: cat.id } });
  created.push(u.id);
  return { id: u.id, token: token!, categoryId: cat.id };
}

async function exam(user: { id: string; categoryId: string }, count = 20) {
  const qs = await db.question.findMany({ where: { categoryId: user.categoryId, isActive: true }, select: { id: true }, take: count });
  return db.testSession.create({
    data: { userId: user.id, mode: 'EXAM', categoryId: user.categoryId, questionIds: qs.map((q) => q.id), totalQ: count, timeLimitSec: 1500, passPercent: 90, startedAt: new Date(Date.now() - 60_000) },
  });
}

test('finish API: two accepted, duplicates free, third rejected with a clear Uzbek message', async () => {
  const u = await newUser();
  const [a, b, c] = [await exam(u), await exam(u), await exam(u)];

  const r1 = await post('/api/tests/finish', { sessionId: a.id }, u.token);
  assert.equal(r1.status, 200);
  assert.equal((await r1.json()).daily.remaining, 1);

  const dup = await post('/api/tests/finish', { sessionId: a.id }, u.token);
  assert.equal(dup.status, 200, 'retrying the same submission is fine');
  assert.equal((await dup.json()).daily.remaining, 1, '…and does not use another attempt');

  const r2 = await post('/api/tests/finish', { sessionId: b.id }, u.token);
  assert.equal((await r2.json()).daily.remaining, 0);

  const r3 = await post('/api/tests/finish', { sessionId: c.id }, u.token);
  assert.equal(r3.status, 429);
  const body = await r3.json();
  assert.equal(body.error, 'daily_limit');
  assert.match(body.message, /Bugungi limit tugadi/);
  assert.equal(body.daily.remaining, 0);
  assert.equal(await db.testSession.count({ where: { userId: u.id, finishedAt: { not: null } } }), 2);

  // The pages show the server's count and stop new full tests.
  const tests = await (await page('/tests', u.token)).text();
  assert.match(tests, /Bugungi limit tugadi/);
  assert.equal((await page(`/test/${c.id}`, u.token)).headers.get('location')?.endsWith('/tests?limit=1'), true, 'an unfinished full test can no longer be continued');
});

test('finish API: concurrent requests for different tests cannot pass the limit', async () => {
  const u = await newUser();
  const sessions = await Promise.all([1, 2, 3, 4, 5].map(() => exam(u)));
  const statuses = await Promise.all(sessions.map((s) => post('/api/tests/finish', { sessionId: s.id }, u.token).then((r) => r.status)));
  assert.equal(statuses.filter((s) => s === 200).length, 2, `statuses: ${statuses}`);
  assert.equal(statuses.filter((s) => s === 429).length, 3);
});

test('finish API: auth, ownership and invalid tests', async () => {
  const [u, other] = [await newUser(), await newUser()];
  const mine = await exam(u);
  assert.equal((await post('/api/tests/finish', { sessionId: mine.id })).status, 401, 'anonymous');
  assert.equal((await post('/api/tests/finish', { sessionId: mine.id }, other.token)).status, 404, "someone else's test");
  assert.equal((await post('/api/tests/finish', { sessionId: '' }, u.token)).status, 400);
  const short = await exam(u, 19);
  const r = await post('/api/tests/finish', { sessionId: short.id }, u.token);
  assert.equal(r.status, 422);
  assert.match((await r.json()).message, /aynan 20 ta savol/);
  // The other user is unaffected by any of this.
  const theirs = await post('/api/tests/finish', { sessionId: (await exam(other)).id }, other.token);
  assert.equal((await theirs.json()).daily.remaining, 1);
});
