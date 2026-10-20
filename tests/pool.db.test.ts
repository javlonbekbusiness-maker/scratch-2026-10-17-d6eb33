/**
 * Shared question pool against the real database: ticket generation stability and exam selection.
 * Creates its own users and questions and deletes them afterwards.
 *   npm run test:db
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/lib/db';
import { startTest } from '../src/lib/tests';
import { grantDays } from '../src/lib/access';
import { assignNewTickets, TICKET_SIZE } from '../src/lib/tickets';
import { FULL_TEST_QUESTIONS } from '../src/lib/daily-limit';

const users: string[] = [];
const questions: string[] = [];
const ticketNumbers: number[] = [];
after(async () => {
  if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
  if (questions.length) await db.question.deleteMany({ where: { id: { in: questions } } });
  if (ticketNumbers.length) await db.ticket.deleteMany({ where: { number: { in: ticketNumbers } } });
  await db.$disconnect();
});

async function makeUser(opts: { subscribed?: boolean; categoryCode?: string } = {}) {
  const n = String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
  const cat = opts.categoryCode ? await db.category.findFirst({ where: { code: opts.categoryCode } }) : null;
  const u = await db.user.create({ data: { phone: `+99894${n}`, name: 'Pool test', onboarded: true, categoryId: cat?.id ?? null, referralCode: `PT${n}${Date.now() % 1e5}` } });
  users.push(u.id);
  if (opts.subscribed) await grantDays(u.id, 1, 'TEST');
  return u;
}
async function makeQuestions(count: number) {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const q = await db.question.create({
      data: {
        textUz: `[TEST] pool ${Date.now()}-${i}`, textRu: '[TEST]',
        answers: { create: [{ textUz: 'A', textRu: 'A', isCorrect: true, sortOrder: 0 }, { textUz: 'B', textRu: 'B', isCorrect: false, sortOrder: 1 }] },
      },
    });
    out.push(q.id);
  }
  questions.push(...out);
  return out;
}
const snapshot = async () =>
  new Map((await db.question.findMany({ where: { ticketNumber: { not: null } }, select: { id: true, ticketNumber: true, sortOrder: true } })).map((q) => [q.id, `${q.ticketNumber}:${q.sortOrder}`]));

test('tickets: re-running generation changes nothing; new questions only form new tickets', async (t) => {
  // Real questions still waiting for a ticket must not be dealt together with this test's throwaway
  // questions (they would end up in a half-empty ticket after cleanup), so set them aside meanwhile.
  const waiting = (await db.question.findMany({ where: { isActive: true, ticketNumber: null }, select: { id: true } })).map((q) => q.id);
  await db.question.updateMany({ where: { id: { in: waiting } }, data: { isActive: false } });
  t.after(() => db.question.updateMany({ where: { id: { in: waiting } }, data: { isActive: true } }));
  const before = await snapshot();
  const maxBefore = (await db.ticket.aggregate({ _max: { number: true } }))._max.number ?? 0;

  assert.equal((await assignNewTickets()).created, 0, 'idempotent');
  assert.deepEqual(await snapshot(), before, 'no question moved');

  // Editing a question that is already in a ticket keeps it there.
  const someId = [...before.keys()][0];
  if (someId) {
    await db.question.update({ where: { id: someId }, data: { explanationUz: `edited ${Date.now()}` } });
    await assignNewTickets();
    assert.deepEqual(await snapshot(), before, 'edit does not reshuffle');
  }

  const added = await makeQuestions(TICKET_SIZE + 5);
  const r = await assignNewTickets();
  assert.equal(r.created, 1, 'one whole new ticket');
  assert.equal(r.firstNumber, maxBefore + 1, 'numbered after the last ticket');
  ticketNumbers.push(maxBefore + 1);
  const after1 = await snapshot();
  for (const [id, pos] of before) assert.equal(after1.get(id), pos, `question ${id} kept its ticket`);
  const inNew = await db.question.findMany({ where: { ticketNumber: maxBefore + 1 }, select: { id: true } });
  assert.equal(inNew.length, TICKET_SIZE);
  assert.ok(inNew.every((q) => added.includes(q.id)), 'new ticket holds only new questions');
  assert.equal(await db.question.count({ where: { id: { in: added }, ticketNumber: null } }), 5, '5 wait for the next ticket');
  assert.ok(await db.ticket.findUnique({ where: { number: maxBefore + 1 } }), 'ticket row exists');
});

test('TICKET mode uses the global ticket number, also for users with a legacy saved category', async () => {
  const u = await makeUser({ subscribed: false, categoryCode: 'C' });
  const r = await startTest(u, { mode: 'TICKET', ticket: 1 });
  assert.ok(r.ok, 'free demo ticket opens');
  if (r.ok) {
    const s = await db.testSession.findUniqueOrThrow({ where: { id: r.sessionId } });
    const expected = await db.question.findMany({ where: { ticketNumber: 1, isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true } });
    assert.deepEqual(s.questionIds, expected.map((q) => q.id));
    assert.equal(s.categoryId, null, 'sessions are not tied to a category');
  }
});

test('exam: 20 unique questions from the whole pool, spread over topics, avoiding the last exam', async () => {
  const u = await makeUser({ subscribed: true });
  const first = await startTest(u, { mode: 'EXAM' });
  assert.ok(first.ok);
  if (!first.ok) return;
  const s1 = await db.testSession.findUniqueOrThrow({ where: { id: first.sessionId } });
  assert.equal(s1.questionIds.length, FULL_TEST_QUESTIONS);
  assert.equal(new Set(s1.questionIds).size, FULL_TEST_QUESTIONS, 'no repeats');
  assert.equal(s1.timeLimitSec, 1500);
  assert.equal(s1.passPercent, 90);

  const qs = await db.question.findMany({ where: { id: { in: s1.questionIds } }, select: { topicId: true, isActive: true } });
  assert.ok(qs.every((q) => q.isActive));
  const topicsInPool = (await db.question.groupBy({ by: ['topicId'], where: { isActive: true } })).length;
  const perTopic = new Map<string, number>();
  for (const q of qs) perTopic.set(q.topicId ?? '-', (perTopic.get(q.topicId ?? '-') ?? 0) + 1);
  assert.ok(Math.max(...perTopic.values()) <= Math.ceil(FULL_TEST_QUESTIONS / topicsInPool) + 1, `balanced: ${[...perTopic.values()]}`);

  // The user answers the first exam; the next one avoids those questions (the pool is big enough).
  await db.sessionAnswer.createMany({ data: s1.questionIds.map((questionId) => ({ sessionId: s1.id, questionId, isCorrect: true })) });
  const second = await startTest(u, { mode: 'EXAM' });
  assert.ok(second.ok);
  if (!second.ok) return;
  const s2 = await db.testSession.findUniqueOrThrow({ where: { id: second.sessionId } });
  const pool = await db.question.count({ where: { isActive: true } });
  if (pool >= 2 * FULL_TEST_QUESTIONS) assert.equal(s2.questionIds.filter((id) => s1.questionIds.includes(id)).length, 0, 'no question from the previous exam');
});
