/**
 * Topics page end to end (real browser via puppeteer-core, against `npm run dev`): list and groups,
 * search, collapsing groups, free sample label and paywall after the free questions (also enforced by
 * the API), subscribers without locks, no horizontal overflow at 375 px, and server response time.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { BASE, RUN_IP, cleanup, db, newUser, page } from './helpers';

const CHROME =
  process.env.CHROME_PATH ??
  ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);

let browser: Browser;
let free: { id: string; token: string };
let paid: { id: string; token: string };

before(async () => {
  assert.ok(CHROME, 'Chrome not found; set CHROME_PATH');
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
  free = await newUser();
  paid = await newUser({ subscribed: true });
});
after(async () => {
  await browser?.close();
  await cleanup();
});

async function open(path: string, token: string, width = 375) {
  const p = await browser.newPage();
  await p.setViewport({ width, height: 812, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p.setCookie({ name: 'lang', value: 'uz', url: BASE }, { name: 'yhq_session', value: token, url: BASE });
  await p.goto(BASE + path, { waitUntil: 'networkidle0' });
  return p;
}
const cards = (p: Page) => p.$$eval('[data-topic]', (els) => els.map((e) => e.getAttribute('data-topic')));
/** Topics users should see: visible, in a visible group (or none), with published questions. */
async function visibleTopics() {
  const counts = await db.question.groupBy({ by: ['topicId'], where: { isActive: true, topicId: { not: null } }, _count: true });
  const withQ = new Set(counts.map((c) => c.topicId));
  const topics = await db.topic.findMany({ where: { isActive: true, OR: [{ groupId: null }, { group: { isActive: true } }] }, select: { id: true, slug: true } });
  return topics.filter((t) => withQ.has(t.id)).map((t) => t.slug);
}

test('list renders every visible topic under its group heading, with counts from the database', async () => {
  const p = await open('/tests/topics', paid.token);
  const expected = await visibleTopics();
  assert.deepEqual(new Set(await cards(p)), new Set(expected));
  const groups = await db.topicGroup.findMany({ where: { isActive: true, topics: { some: { slug: { in: expected } } } } });
  const headings = await p.$$eval('section h2 button', (els) => els.map((e) => e.textContent ?? ''));
  for (const g of groups) assert.ok(headings.some((h) => h.includes(g.nameUz)), `group ${g.nameUz}`);
  const parking = await db.topic.findUniqueOrThrow({ where: { slug: 'parking' } });
  const n = await db.question.count({ where: { topicId: parking.id, isActive: true } });
  assert.match(await p.$eval('[data-topic="parking"]', (e) => e.textContent ?? ''), new RegExp(`${n} ta savol`));
  await p.close();
});

test('search filters by name, ignoring apostrophes, and also finds Russian names', async () => {
  const p = await open('/tests/topics', paid.token);
  await p.type('#topic-search', 'toxtash');
  await p.waitForFunction(() => document.querySelectorAll('[data-topic]').length < 5, { timeout: 5000 });
  assert.deepEqual(await cards(p), ['parking']);
  await p.click('#topic-search', { count: 3 });
  await p.keyboard.press('Backspace');
  await p.type('#topic-search', 'обгон');
  await p.waitForFunction(() => [...document.querySelectorAll('[data-topic]')].map((e) => e.getAttribute('data-topic')).join() === 'overtaking', { timeout: 5000 });
  await p.click('#topic-search', { count: 3 });
  await p.keyboard.press('Backspace');
  await p.type('#topic-search', 'zzzz-nothing');
  await p.waitForFunction(() => document.querySelectorAll('[data-topic]').length === 0, { timeout: 5000 });
  assert.match(await p.$eval('#topic-count', (e) => e.textContent ?? ''), /0 ta mavzu/);
  await p.close();
});

test('group sections collapse and expand; status chips filter', async () => {
  const p = await open('/tests/topics', paid.token);
  const first = 'section h2 button';
  const listId = await p.$eval(first, (e) => e.getAttribute('aria-controls'));
  assert.ok(await p.$(`#${listId}`), 'open by default');
  await p.click(first);
  assert.equal(await p.$eval(first, (e) => e.getAttribute('aria-expanded')), 'false');
  assert.equal(await p.$(`#${listId}`), null, 'collapsed');
  await p.click(first);
  assert.ok(await p.$(`#${listId}`), 'expanded again');
  // A fresh subscriber has not started anything: "Boshlanmagan" keeps all, "Tugatilgan" shows none.
  const total = (await cards(p)).length;
  await p.click('button[aria-pressed]:nth-of-type(2)');
  assert.equal((await cards(p)).length, total);
  await p.click('button[aria-pressed]:nth-of-type(5)');
  assert.equal((await cards(p)).length, 0);
  await p.close();
});

test('free user: "Bepul: 3 savol" on cards, sample of 3 questions, then the paywall; API refuses more', async () => {
  const p = await open('/tests/topics', free.token);
  const labels = await p.$$eval('[data-free-label]', (els) => els.map((e) => e.textContent));
  assert.ok(labels.length > 0 && labels.every((l) => /Bepul: \d+ savol/.test(l ?? '')), `labels: ${labels.slice(0, 3)}`);
  assert.equal(labels.length, (await cards(p)).length, 'every card shows the free label');

  await p.goto(`${BASE}/tests/topics/parking`, { waitUntil: 'networkidle0' });
  assert.ok(await p.$('a[href="/pricing"]'), 'Hammasini ochish → /pricing');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }), p.click('button[data-variant="all"]')]);
  const sessionId = /\/test\/([^/?#]+)/.exec(p.url())?.[1];
  assert.ok(sessionId, `in a test: ${p.url()}`);
  const s = await db.testSession.findUniqueOrThrow({ where: { id: sessionId } });
  assert.equal(s.isSample, true);
  assert.equal(s.questionIds.length, 3);

  for (let i = 0; i < 3; i++) {
    await p.waitForSelector('ul[aria-label] button:not([disabled])');
    await p.click('ul[aria-label] li:first-child button');
    await p.waitForFunction(() => !!document.querySelector('[role="status"]'), { timeout: 8000 });
    if (i < 2) await p.click('button.btn-primary.flex-1');
  }
  await p.waitForSelector('[data-testid="sample-paywall"]', { visible: true, timeout: 8000 });
  assert.ok(await p.$('[data-testid="sample-paywall"] a[href="/pricing"]'));
  assert.equal(await db.sessionAnswer.count({ where: { sessionId } }), 3, 'answers recorded');

  // Server side: a question outside the free sample is refused even with a valid session.
  const parking = await db.topic.findUniqueOrThrow({ where: { slug: 'parking' } });
  const outside = await db.question.findFirstOrThrow({ where: { topicId: parking.id, isActive: true, id: { notIn: s.questionIds } }, include: { answers: true } });
  await db.testSession.update({ where: { id: sessionId }, data: { questionIds: [...s.questionIds, outside.id] } }); // simulate tampering
  const r = await fetch(`${BASE}/api/tests/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `yhq_session=${free.token}`, 'X-Forwarded-For': RUN_IP },
    body: JSON.stringify({ sessionId, questionId: outside.id, answerId: outside.answers[0].id }),
  });
  assert.equal(r.status, 402);
  // Starting a "quick" or "mistakes" topic test as a free user still only gives the sample.
  const before = await db.testSession.count({ where: { userId: free.id } });
  await p.goto(`${BASE}/tests/topics/parking`, { waitUntil: 'networkidle0' });
  assert.equal(await p.$('button[data-variant="quick"]'), null, 'no subscriber buttons for free users');
  assert.equal(await db.testSession.count({ where: { userId: free.id } }), before);
  await p.close();
});

test('subscriber: no locks or free labels; detail offers all, mistakes and quick', async () => {
  const p = await open('/tests/topics', paid.token);
  assert.equal((await p.$$('[data-free-label]')).length, 0);
  assert.equal(await p.$$eval('[data-topic]', (els) => els.filter((e) => e.textContent?.includes('Yopiq')).length), 0);
  await p.goto(`${BASE}/tests/topics/parking`, { waitUntil: 'networkidle0' });
  for (const v of ['all', 'mistakes', 'quick']) assert.ok(await p.$(`button[data-variant="${v}"]`), v);
  assert.ok(await p.$('a[href^="/library"]'), 'link to the rules library');
  await p.close();
});

test('no horizontal overflow at 375 px (list and detail, free and subscriber)', async () => {
  const problems: string[] = [];
  for (const [token, who] of [[free.token, 'free'], [paid.token, 'paid']] as const) {
    for (const path of ['/tests/topics', '/tests/topics/parking', '/tests/topics/ch-29']) {
      const p = await open(path, token, 375);
      const { scroll, client } = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      if (scroll > client) problems.push(`${who} ${path}: ${scroll} > ${client}`);
      const small = await p.$$eval('a[data-topic], button[aria-pressed], section h2 button, button[data-variant]', (els) =>
        els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 47.5).map((e) => (e.textContent ?? '').slice(0, 20)),
      );
      if (small.length) problems.push(`${who} ${path}: tap targets under 48px: ${small.slice(0, 3)}`);
      await p.close();
    }
  }
  assert.deepEqual(problems, []);
});

test('server response time for /tests/topics (run npm run db:seed-bulk first to measure with 1200+ questions)', async () => {
  await page('/tests/topics', paid.token); // warm up (dev compile)
  const ms: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    const r = await page('/tests/topics', paid.token);
    await r.text();
    ms.push(performance.now() - t);
  }
  ms.sort((a, b) => a - b);
  const median = ms[2];
  console.log(`/tests/topics full HTML response (dev server): median ${median.toFixed(0)} ms, runs ${ms.map((x) => x.toFixed(0)).join(', ')}`);
  assert.ok(median < 3000, `median ${median} ms`);
});
