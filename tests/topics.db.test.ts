/**
 * Topic tests against the real database: the free sample (server side), subscriber variants,
 * hidden and empty topics. Creates its own users and deletes them afterwards.
 *   npm run test:db
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/lib/db';
import { startTest } from '../src/lib/tests';
import { grantDays } from '../src/lib/access';
import { QUICK_TOPIC_SIZE, freeTopicQuestions, topicSampleIds, topicsOverview } from '../src/lib/topics';

const users: string[] = [];
after(async () => {
  if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

async function makeUser(subscribed: boolean) {
  const n = String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
  const u = await db.user.create({ data: { phone: `+99893${n}`, name: 'Topic test', onboarded: true, referralCode: `TT${n}${Date.now() % 1e5}` } });
  users.push(u.id);
  if (subscribed) await grantDays(u.id, 1, 'TEST');
  return u;
}
const biggestTopic = async () => {
  const [top] = await db.question.groupBy({ by: ['topicId'], where: { isActive: true, topicId: { not: null } }, _count: true, orderBy: { _count: { topicId: 'desc' } }, take: 1 });
  return db.topic.findUniqueOrThrow({ where: { id: top.topicId! } });
};

test('free user: every variant gives the same fixed free sample, marked as a sample', async () => {
  const u = await makeUser(false);
  const topic = await biggestTopic();
  const free = await freeTopicQuestions();
  assert.ok(free > 0, 'free sample enabled by default');
  const expected = await topicSampleIds(topic.id, free);
  for (const variant of ['all', 'quick', 'mistakes'] as const) {
    const r = await startTest(u, { mode: 'TOPIC', topic: topic.slug, variant });
    assert.ok(r.ok, variant);
    if (!r.ok) continue;
    const s = await db.testSession.findUniqueOrThrow({ where: { id: r.sessionId } });
    assert.equal(s.isSample, true);
    assert.deepEqual(s.questionIds, expected, `${variant}: first ${free} questions in a fixed order`);
  }
});

test('free sample size comes from the admin setting; 0 makes topics subscriber-only', async () => {
  const u = await makeUser(false);
  const topic = await biggestTopic();
  const before = await db.setting.findUnique({ where: { key: 'freeTopicQuestions' } });
  try {
    await db.setting.upsert({ where: { key: 'freeTopicQuestions' }, create: { key: 'freeTopicQuestions', value: 5 }, update: { value: 5 } });
    const r = await startTest(u, { mode: 'TOPIC', topic: topic.slug });
    assert.ok(r.ok);
    if (r.ok) assert.equal((await db.testSession.findUniqueOrThrow({ where: { id: r.sessionId } })).questionIds.length, 5);
    await db.setting.update({ where: { key: 'freeTopicQuestions' }, data: { value: 0 } });
    assert.deepEqual(await startTest(u, { mode: 'TOPIC', topic: topic.slug }), { ok: false, error: 'locked' });
  } finally {
    if (before) await db.setting.update({ where: { key: 'freeTopicQuestions' }, data: { value: before.value as number } });
    else await db.setting.delete({ where: { key: 'freeTopicQuestions' } });
  }
});

test('subscriber: all questions, quick 10, and only own mistakes; never a sample', async () => {
  const u = await makeUser(true);
  const topic = await biggestTopic();
  const total = await db.question.count({ where: { topicId: topic.id, isActive: true } });

  const all = await startTest(u, { mode: 'TOPIC', topic: topic.slug, variant: 'all' });
  assert.ok(all.ok);
  if (all.ok) {
    const s = await db.testSession.findUniqueOrThrow({ where: { id: all.sessionId } });
    assert.equal(s.isSample, false);
    assert.equal(s.questionIds.length, total);
  }
  const quick = await startTest(u, { mode: 'TOPIC', topic: topic.slug, variant: 'quick' });
  assert.ok(quick.ok);
  if (quick.ok) assert.equal((await db.testSession.findUniqueOrThrow({ where: { id: quick.sessionId } })).questionIds.length, Math.min(QUICK_TOPIC_SIZE, total));

  assert.deepEqual(await startTest(u, { mode: 'TOPIC', topic: topic.slug, variant: 'mistakes' }), { ok: false, error: 'empty' }, 'no mistakes yet');
  const qs = await db.question.findMany({ where: { topicId: topic.id, isActive: true }, take: 2, select: { id: true } });
  await db.reviewItem.createMany({ data: qs.map((q) => ({ userId: u.id, questionId: q.id })) });
  const mistakes = await startTest(u, { mode: 'TOPIC', topic: topic.slug, variant: 'mistakes' });
  assert.ok(mistakes.ok);
  if (mistakes.ok) assert.deepEqual(new Set((await db.testSession.findUniqueOrThrow({ where: { id: mistakes.sessionId } })).questionIds), new Set(qs.map((q) => q.id)));
});

test('hidden topics and topics without published questions are not shown or startable', async () => {
  const u = await makeUser(true);
  const empty = await db.topic.create({ data: { slug: `t-empty-${Date.now() % 1e6}`, nameUz: '[TEST] bo‘sh', nameRu: '[TEST] пусто' } });
  const topic = await biggestTopic();
  try {
    let overview = await topicsOverview(u.id);
    assert.ok(!overview.items.some((t) => t.id === empty.id), 'topic with 0 questions hidden');
    assert.ok(overview.items.some((t) => t.id === topic.id));
    const count = overview.items.find((t) => t.id === topic.id)!.total;
    assert.equal(count, await db.question.count({ where: { topicId: topic.id, isActive: true } }), 'count computed from the database');

    await db.topic.update({ where: { id: topic.id }, data: { isActive: false } });
    overview = await topicsOverview(u.id);
    assert.ok(!overview.items.some((t) => t.id === topic.id), 'hidden topic not listed');
    assert.deepEqual(await startTest(u, { mode: 'TOPIC', topic: topic.slug }), { ok: false, error: 'empty' }, 'hidden topic cannot be started');
  } finally {
    await db.topic.update({ where: { id: topic.id }, data: { isActive: true } });
    await db.topic.delete({ where: { id: empty.id } });
  }
});
