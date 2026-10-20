/**
 * Shared question pool end to end (real browser via puppeteer-core, against `npm run dev`):
 * no category is asked anywhere, tickets stay stable when questions are added, and exams started
 * from the /tests page get 20 unique, topic-balanced questions that avoid the previous exam.
 * Works with the demo seed alone; `npm run db:seed-bulk` makes the pool 1200+.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { BASE, cleanup, db, newUser, page } from './helpers';
import { assignNewTickets, TICKET_SIZE } from '../src/lib/tickets';

const CHROME =
  process.env.CHROME_PATH ??
  ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);

let browser: Browser;
let user: { id: string; token: string };
const addedQuestions: string[] = [];
const addedTickets: number[] = [];

before(async () => {
  assert.ok(CHROME, 'Chrome not found; set CHROME_PATH');
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
  user = await newUser({ subscribed: true });
});
after(async () => {
  await browser?.close();
  if (addedQuestions.length) await db.question.deleteMany({ where: { id: { in: addedQuestions } } });
  if (addedTickets.length) await db.ticket.deleteMany({ where: { number: { in: addedTickets } } });
  await cleanup();
});

async function open(path: string) {
  const p = await browser.newPage();
  await p.setCookie({ name: 'lang', value: 'uz', url: BASE }, { name: 'yhq_session', value: user.token, url: BASE });
  await p.goto(BASE + path, { waitUntil: 'networkidle0' });
  return p;
}
/** Submits the start form matching `selector` and returns the new session id from the /test/<id> URL. */
async function start(p: Page, selector: string) {
  await Promise.all([p.waitForNavigation({ waitUntil: 'domcontentloaded' }), p.click(`form:has(${selector}) button`)]);
  const id = /\/test\/([^/?#]+)/.exec(p.url())?.[1];
  assert.ok(id, `landed on a test page, got ${p.url()}`);
  return db.testSession.findUniqueOrThrow({ where: { id } });
}
const ticketQuestions = async (n: number) =>
  (await db.question.findMany({ where: { ticketNumber: n, isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true } })).map((q) => q.id);

test('no licence category is asked for anywhere', async () => {
  for (const path of ['/tests', '/settings', '/profile', '/dashboard']) {
    const html = await (await page(path, user.token)).text();
    assert.doesNotMatch(html, /name="categoryId"/, `${path} has no category field`);
    assert.doesNotMatch(html, /toifa/i, `${path} does not mention a category`);
  }
  // A new user's onboarding asks only for the name (and optional email).
  const fresh = await newUser();
  await db.user.update({ where: { id: fresh.id }, data: { onboarded: false } });
  const onboarding = await (await page('/onboarding', fresh.token)).text();
  assert.match(onboarding, /name="name"/);
  assert.doesNotMatch(onboarding, /name="categoryId"|toifa/i);
});

test('tickets: started from the list, unchanged after new questions are added', async () => {
  await assignNewTickets(); // settle leftovers so the counts below are exact
  const total = await db.ticket.count();
  assert.ok(total >= 2, 'demo seed has tickets');
  const n = Math.min(2, total);
  const before = await ticketQuestions(n);

  const p = await open('/tests/tickets');
  const s1 = await start(p, `input[name="ticket"][value="${n}"]`);
  assert.deepEqual(s1.questionIds, before, 'session uses exactly the ticket’s questions');

  // An admin adds questions: they form a new ticket at the end; ticket n is untouched.
  for (let i = 0; i < TICKET_SIZE; i++) {
    const q = await db.question.create({
      data: { textUz: `[TEST] e2e ${Date.now()}-${i}`, textRu: '[TEST]', answers: { create: [{ textUz: 'A', textRu: 'A', isCorrect: true, sortOrder: 0 }, { textUz: 'B', textRu: 'B', isCorrect: false, sortOrder: 1 }] } },
    });
    addedQuestions.push(q.id);
  }
  const r = await assignNewTickets();
  assert.equal(r.created, 1);
  addedTickets.push(r.firstNumber!);
  assert.equal(r.firstNumber, total + 1);
  assert.deepEqual(await ticketQuestions(n), before, 'existing ticket did not change');

  await p.goto(`${BASE}/tests/tickets`, { waitUntil: 'networkidle0' });
  const s2 = await start(p, `input[name="ticket"][value="${n}"]`);
  assert.deepEqual(s2.questionIds, before, 'starting the same ticket again gives the same questions');

  // The new ticket is listed (on the last page when there are many).
  const pages = Math.ceil((total + 1) / 40);
  const last = await (await page(`/tests/tickets${pages > 1 ? `?page=${pages}` : ''}`, user.token)).text();
  assert.match(last, new RegExp(`name="ticket" value="${total + 1}"`));
  if (pages > 1) assert.match(await (await page('/tests/tickets', user.token)).text(), /href="\/tests\/tickets\?page=2"/, 'pagination link');
  await p.close();
});

test('exam from /tests: 20 unique, spread over topics, avoids the questions of the previous exam', async () => {
  const p = await open('/tests');
  const s1 = await start(p, 'input[name="mode"][value="EXAM"]');
  assert.equal(s1.mode, 'EXAM');
  assert.equal(s1.questionIds.length, 20);
  assert.equal(new Set(s1.questionIds).size, 20, 'no repeats');
  const qs = await db.question.findMany({ where: { id: { in: s1.questionIds } }, select: { topicId: true } });
  const topics = (await db.question.groupBy({ by: ['topicId'], where: { isActive: true } })).length;
  const perTopic = new Map<string, number>();
  for (const q of qs) perTopic.set(q.topicId ?? '-', (perTopic.get(q.topicId ?? '-') ?? 0) + 1);
  assert.equal(perTopic.size, Math.min(topics, 20), 'as many topics as possible');
  assert.ok(Math.max(...perTopic.values()) - Math.min(...perTopic.values()) <= 1, `balanced: ${[...perTopic.values()]}`);

  // Answer it (as the test runner does), then start another exam.
  await db.sessionAnswer.createMany({ data: s1.questionIds.map((questionId) => ({ sessionId: s1.id, questionId, isCorrect: true })) });
  await p.goto(`${BASE}/tests`, { waitUntil: 'networkidle0' });
  const s2 = await start(p, 'input[name="mode"][value="EXAM"]');
  const pool = await db.question.count({ where: { isActive: true } });
  const overlap = s2.questionIds.filter((id) => s1.questionIds.includes(id)).length;
  assert.equal(overlap, Math.max(0, 40 - pool), 'repeats only when the pool is smaller than two exams');
  await p.close();
});

test('topics: search and pagination', async () => {
  const total = await db.topic.count({ where: { questions: { some: { isActive: true } } } });
  const html = await (await page('/tests/topics', user.token)).text();
  assert.match(html, /role="search"/);
  if (total > 24) assert.match(html, /href="\/tests\/topics\?page=2"/);
  const none = await (await page('/tests/topics?q=zzzz-no-such-topic', user.token)).text();
  assert.match(none, /Hech narsa topilmadi/);
  const one = await db.topic.findFirstOrThrow({ where: { questions: { some: { isActive: true } } }, orderBy: { sortOrder: 'asc' } });
  const found = await (await page(`/tests/topics?q=${encodeURIComponent(one.nameUz.slice(0, 6))}`, user.token)).text();
  assert.match(found, new RegExp(`value="${one.slug}"`), 'search finds the topic');
});
