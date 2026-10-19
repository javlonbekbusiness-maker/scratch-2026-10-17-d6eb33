/**
 * Daily full-test limit against the real database (no web server needed).
 *   npm run test:db
 * Needs DATABASE_URL (from .env) and seeded questions for category B. Each test creates its own
 * throwaway users (+99898…) and they are deleted at the end; no other data is touched.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { db } from '../src/lib/db';
import { finishSession, startTest } from '../src/lib/tests';
import { grantDays } from '../src/lib/access';
import { countFullTestsToday, FULL_TEST_QUESTIONS } from '../src/lib/daily-limit';

const created: string[] = [];
after(async () => {
  if (created.length) await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

async function category() {
  return db.category.findFirstOrThrow({ where: { code: 'B' } });
}

async function makeUser() {
  const cat = await category();
  const n = String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
  const u = await db.user.create({
    data: { phone: `+99898${n}`, name: 'Limit test', onboarded: true, categoryId: cat.id, referralCode: `LT${n}${Date.now() % 1e5}` },
  });
  created.push(u.id);
  return u;
}

/** An in-progress full test, created the way startTest does (20 distinct questions). */
async function makeExam(userId: string, startedAt: Date, count = FULL_TEST_QUESTIONS) {
  const cat = await category();
  const qs = await db.question.findMany({ where: { categoryId: cat.id, isActive: true }, select: { id: true }, take: count });
  assert.equal(qs.length, count, `seed has at least ${count} active B questions`);
  return db.testSession.create({
    data: { userId, mode: 'EXAM', categoryId: cat.id, questionIds: qs.map((q) => q.id), totalQ: count, timeLimitSec: 1500, passPercent: 90, startedAt },
  });
}

const minutesBefore = (d: Date, m: number) => new Date(d.getTime() - m * 60_000);
const finishedCount = (userId: string) => db.testSession.count({ where: { userId, mode: 'EXAM', finishedAt: { not: null } } });

test('1–3: first and second completed tests are accepted, the third is rejected', async () => {
  const u = await makeUser();
  const now = new Date();
  const [a, b, c] = [await makeExam(u.id, minutesBefore(now, 30)), await makeExam(u.id, minutesBefore(now, 20)), await makeExam(u.id, minutesBefore(now, 10))];

  const r1 = await finishSession(a.id, { now });
  assert.ok(r1.ok);
  assert.deepEqual(r1.ok && { used: r1.daily?.used, remaining: r1.daily?.remaining }, { used: 1, remaining: 1 });
  const r2 = await finishSession(b.id, { now });
  assert.ok(r2.ok && r2.daily?.remaining === 0);
  const r3 = await finishSession(c.id, { now });
  assert.deepEqual(r3.ok ? null : r3.error, 'daily_limit');

  assert.equal(await finishedCount(u.id), 2);
  assert.equal((await db.testSession.findUniqueOrThrow({ where: { id: c.id } })).finishedAt, null, 'rejected test is not saved');
});

test('score is computed on the server from stored answers only', async () => {
  const u = await makeUser();
  const now = new Date();
  const s = await makeExam(u.id, minutesBefore(now, 5));
  const qs = await db.question.findMany({ where: { id: { in: s.questionIds.slice(0, 5) } }, include: { answers: true } });
  for (const q of qs) {
    const right = q.answers.find((x) => x.isCorrect)!;
    await db.sessionAnswer.create({ data: { sessionId: s.id, questionId: q.id, answerId: right.id, isCorrect: true } });
  }
  const r = await finishSession(s.id, { now });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.session.correctQ, 5);
    assert.equal(r.session.score, 25, '5 of 20 correct');
    assert.equal(r.session.passed, false);
  }
});

test('4: an abandoned (never submitted) test does not use up the limit', async () => {
  const u = await makeUser();
  const now = new Date();
  const abandoned = await makeExam(u.id, minutesBefore(now, 40));
  await db.sessionAnswer.create({ data: { sessionId: abandoned.id, questionId: abandoned.questionIds[0], isCorrect: false } });
  assert.equal(await countFullTestsToday(db, u.id, now), 0);

  assert.ok((await finishSession((await makeExam(u.id, minutesBefore(now, 20))).id, { now })).ok);
  assert.ok((await finishSession((await makeExam(u.id, minutesBefore(now, 10))).id, { now })).ok, 'two submitted tests still allowed');
  assert.equal((await db.testSession.findUniqueOrThrow({ where: { id: abandoned.id } })).finishedAt, null);
});

test('5: invalid full tests (fewer than 20 questions, or inconsistent counts) are rejected and not counted', async () => {
  const u = await makeUser();
  const now = new Date();
  const short = await makeExam(u.id, minutesBefore(now, 5), FULL_TEST_QUESTIONS - 1);
  assert.deepEqual(await finishSession(short.id, { now }), { ok: false, error: 'invalid_test' });

  const mismatched = await makeExam(u.id, minutesBefore(now, 5));
  await db.testSession.update({ where: { id: mismatched.id }, data: { totalQ: 19 } });
  assert.deepEqual(await finishSession(mismatched.id, { now }), { ok: false, error: 'invalid_test' });

  const duplicated = await makeExam(u.id, minutesBefore(now, 5));
  await db.testSession.update({ where: { id: duplicated.id }, data: { questionIds: [...duplicated.questionIds.slice(0, 19), duplicated.questionIds[0]] } });
  assert.deepEqual(await finishSession(duplicated.id, { now }), { ok: false, error: 'invalid_test' });

  assert.equal(await countFullTestsToday(db, u.id, now), 0);
});

test('6: duplicate submissions of the same test (sequential and concurrent) count once', async () => {
  const u = await makeUser();
  const now = new Date();
  const s = await makeExam(u.id, minutesBefore(now, 5));
  const results = await Promise.all(Array.from({ length: 6 }, () => finishSession(s.id, { now })));
  assert.ok(results.every((r) => r.ok), 'every retry gets the saved result');
  const again = await finishSession(s.id, { now: new Date(now.getTime() + 60_000) });
  assert.ok(again.ok && again.session.finishedAt?.getTime() === now.getTime(), 'a later retry does not re-save');
  assert.equal(await finishedCount(u.id), 1);
  assert.ok(again.ok && again.daily?.remaining === 1);
});

test('7: concurrent submissions of different tests cannot exceed the limit', async () => {
  const u = await makeUser();
  const now = new Date();
  const sessions = await Promise.all(Array.from({ length: 6 }, (_, i) => makeExam(u.id, minutesBefore(now, 30 - i))));
  const results = await Promise.all(sessions.map((s) => finishSession(s.id, { now })));
  assert.equal(results.filter((r) => r.ok).length, 2);
  assert.equal(results.filter((r) => !r.ok && r.error === 'daily_limit').length, 4);
  assert.equal(await finishedCount(u.id), 2);
});

test('8: the limit resets at midnight Asia/Tashkent', async () => {
  const u = await makeUser();
  const at = (iso: string) => new Date(iso);
  // 23:58 and 23:59 on 10 March 2025 in Tashkent (UTC+5).
  assert.ok((await finishSession((await makeExam(u.id, at('2025-03-10T18:30:00Z'))).id, { now: at('2025-03-10T18:58:00Z') })).ok);
  assert.ok((await finishSession((await makeExam(u.id, at('2025-03-10T18:31:00Z'))).id, { now: at('2025-03-10T18:59:00Z') })).ok);
  const third = await makeExam(u.id, at('2025-03-10T18:32:00Z'));
  const late = await finishSession(third.id, { now: at('2025-03-10T18:59:59Z') });
  assert.ok(!late.ok && late.error === 'daily_limit', '23:59:59 is still the same day');
  // 00:00:01 on 11 March: a fresh allowance.
  const next = await finishSession(third.id, { now: at('2025-03-10T19:00:01Z') });
  assert.ok(next.ok && next.daily?.used === 1 && next.daily.remaining === 1);
  assert.equal(next.ok && next.daily?.resetsAt.toISOString(), '2025-03-11T19:00:00.000Z');
});

test('9: one user reaching the limit does not affect another user', async () => {
  const [a, b] = [await makeUser(), await makeUser()];
  const now = new Date();
  for (let i = 0; i < 2; i++) assert.ok((await finishSession((await makeExam(a.id, minutesBefore(now, 10 + i))).id, { now })).ok);
  const blocked = await finishSession((await makeExam(a.id, minutesBefore(now, 5))).id, { now });
  assert.ok(!blocked.ok);
  const other = await finishSession((await makeExam(b.id, minutesBefore(now, 5))).id, { now });
  assert.ok(other.ok && other.daily?.remaining === 1);
});

test('10: if saving the result fails, nothing is counted and the test can be submitted again', async () => {
  const u = await makeUser();
  const now = new Date();
  const s = await makeExam(u.id, minutesBefore(now, 5));

  // Fails after the session row was updated inside the transaction: the whole transaction must roll back.
  const failLate = db.$extends({ query: { user: { async update() { throw new Error('simulated database failure'); } } } });
  await assert.rejects(finishSession(s.id, { client: failLate as unknown as PrismaClient, now }), /simulated database failure/);
  // Fails on the session write itself.
  const failSave = db.$extends({ query: { testSession: { async updateMany() { throw new Error('simulated write failure'); } } } });
  await assert.rejects(finishSession(s.id, { client: failSave as unknown as PrismaClient, now }), /simulated write failure/);

  const row = await db.testSession.findUniqueOrThrow({ where: { id: s.id } });
  assert.equal(row.finishedAt, null, 'result not saved');
  assert.equal(await countFullTestsToday(db, u.id, now), 0, 'no attempt consumed');

  const retry = await finishSession(s.id, { now });
  assert.ok(retry.ok && retry.daily?.used === 1);
});

test('starting: a full test always has exactly 20 questions, and starting is refused once the limit is reached', async () => {
  const u = await makeUser();
  await grantDays(u.id, 1, 'TEST');
  const first = await startTest(u, { mode: 'EXAM' });
  assert.ok(first.ok);
  if (first.ok) {
    const s = await db.testSession.findUniqueOrThrow({ where: { id: first.sessionId } });
    assert.equal(s.totalQ, FULL_TEST_QUESTIONS);
    assert.equal(new Set(s.questionIds).size, FULL_TEST_QUESTIONS);
    assert.ok((await finishSession(s.id)).ok);
  }
  const second = await startTest(u, { mode: 'EXAM' });
  assert.ok(second.ok);
  if (second.ok) assert.ok((await finishSession(second.sessionId)).ok);
  assert.deepEqual(await startTest(u, { mode: 'EXAM' }), { ok: false, error: 'limit' });
  // Practice modes stay unlimited.
  assert.ok((await startTest(u, { mode: 'TICKET', ticket: 1 })).ok);
});
