/**
 * Home screen data against the real database: trap questions, the TRICKY mode, resume rules,
 * daily goal. Creates its own users and one test question; deletes them afterwards.
 *   npm run test:db
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/lib/db';
import { startTest, finishSession } from '../src/lib/tests';
import { grantDays } from '../src/lib/access';
import { getTrickyQuestions, TRICKY_MIN_ANSWERS } from '../src/lib/tricky';
import { answersToday, getResumeSession } from '../src/lib/home';

const users: string[] = [];
const questions: string[] = [];
after(async () => {
  if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
  if (questions.length) await db.question.deleteMany({ where: { id: { in: questions } } });
  await db.$disconnect();
});

const catB = () => db.category.findFirstOrThrow({ where: { code: 'B' } });
async function makeUser(subscribed = false) {
  const cat = await catB();
  const n = String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
  const u = await db.user.create({ data: { phone: `+99895${n}`, name: 'Home test', onboarded: true, categoryId: cat.id, referralCode: `HT${n}${Date.now() % 1e5}` } });
  users.push(u.id);
  if (subscribed) await grantDays(u.id, 1, 'TEST');
  return u;
}
async function makeQuestion(isTricky: boolean) {
  const cat = await catB();
  const q = await db.question.create({
    data: {
      categoryId: cat.id, textUz: `[TEST] trap ${Date.now()}`, textRu: '[TEST]', explanationUz: '', explanationRu: '', isTricky,
      answers: { create: [{ textUz: 'A', textRu: 'A', isCorrect: true, sortOrder: 0 }, { textUz: 'B', textRu: 'B', isCorrect: false, sortOrder: 1 }] },
    },
  });
  questions.push(q.id);
  return q;
}

test('trap questions: admin-flagged ones are always included; most-missed need enough real answers', async () => {
  const cat = await catB();
  const flagged = await makeQuestion(true);
  const missed = await makeQuestion(false);
  const before = await getTrickyQuestions();
  assert.ok(before.ids.includes(flagged.id), 'flagged question listed');
  assert.ok(!before.ids.includes(missed.id), 'no answers yet → not listed');

  // Real wrong answers from a user push the second question over the threshold.
  const u = await makeUser();
  const s = await db.testSession.create({ data: { userId: u.id, mode: 'MARATHON', categoryId: cat.id, questionIds: [missed.id], totalQ: 1 } });
  const wrong = await db.answer.findFirstOrThrow({ where: { questionId: missed.id, isCorrect: false } });
  // One answer per session per question, so use separate sessions.
  await db.sessionAnswer.create({ data: { sessionId: s.id, questionId: missed.id, answerId: wrong.id, isCorrect: false } });
  for (let i = 1; i < TRICKY_MIN_ANSWERS; i++) {
    const si = await db.testSession.create({ data: { userId: u.id, mode: 'MARATHON', categoryId: cat.id, questionIds: [missed.id], totalQ: 1 } });
    await db.sessionAnswer.create({ data: { sessionId: si.id, questionId: missed.id, answerId: wrong.id, isCorrect: false } });
  }
  // getTrickyQuestions is cached per request in the app; call the query fresh here.
  const afterAnswers = await (await import('../src/lib/tricky')).getTrickyQuestions(500);
  assert.ok(afterAnswers.ids.includes(missed.id), 'now listed from real data');
  assert.equal(afterAnswers.missRate.get(missed.id), 100);
});

test('TRICKY mode: needs a subscription, then starts a session of trap questions', async () => {
  const free = await makeUser(false);
  assert.deepEqual(await startTest(free, { mode: 'TRICKY' }), { ok: false, error: 'locked' });
  const paid = await makeUser(true);
  const r = await startTest(paid, { mode: 'TRICKY' });
  assert.ok(r.ok);
  if (r.ok) {
    const s = await db.testSession.findUniqueOrThrow({ where: { id: r.sessionId } });
    assert.equal(s.mode, 'TRICKY');
    assert.ok(s.totalQ >= 1 && s.totalQ <= 20);
    const done = await finishSession(s.id);
    assert.ok(done.ok && done.daily === null, 'practice mode does not touch the daily full-test limit');
  }
});

test('resume: newest unfinished, skips timed-out and fully answered sessions', async () => {
  const u = await makeUser(true);
  const cat = await catB();
  const qs = await db.question.findMany({ where: { categoryId: cat.id, ticketNumber: 1 }, select: { id: true }, take: 3 });
  assert.equal(await getResumeSession(u), null, 'nothing to resume');

  const old = await db.testSession.create({ data: { userId: u.id, mode: 'TICKET', ticketNumber: 1, categoryId: cat.id, questionIds: qs.map((q) => q.id), totalQ: qs.length, startedAt: new Date(Date.now() - 3600_000) } });
  await db.testSession.create({ data: { userId: u.id, mode: 'EXAM', categoryId: cat.id, questionIds: qs.map((q) => q.id), totalQ: qs.length, timeLimitSec: 60, startedAt: new Date(Date.now() - 600_000) } });
  const r = await getResumeSession(u);
  assert.equal(r?.id, old.id, 'timed-out exam skipped, older ticket offered');
  assert.equal(r?.answered, 0);

  for (const q of qs) await db.sessionAnswer.create({ data: { sessionId: old.id, questionId: q.id, isCorrect: true } });
  assert.equal(await getResumeSession(u), null, 'fully answered session is not offered');
  assert.equal(await answersToday(u.id), qs.length, 'daily goal counts today’s answers');
});
