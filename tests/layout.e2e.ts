/**
 * Layout checks in a real browser (system Chrome via puppeteer-core): no horizontal overflow at
 * phone widths, 48px tap targets in the tab bar, tab bar hidden in a running test.
 * Set CHROME_PATH if Chrome is not in the default location. Runs against `npm run dev`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';
import { BASE, cleanup, db, newUser } from './helpers';

const CHROME =
  process.env.CHROME_PATH ??
  ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);

let browser: Browser;
let token = '';
let userId = '';

before(async () => {
  assert.ok(CHROME, 'Chrome not found; set CHROME_PATH');
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run'] });
  const u = await newUser({ subscribed: true });
  token = u.token;
  userId = u.id;
});
after(async () => {
  await browser?.close();
  await cleanup();
});

async function open(path: string, width: number, signedIn: boolean) {
  const p = await browser.newPage();
  await p.setViewport({ width, height: 800, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const cookies = [{ name: 'lang', value: 'uz', url: BASE }];
  if (signedIn) cookies.push({ name: 'yhq_session', value: token, url: BASE });
  await p.setCookie(...cookies);
  await p.goto(BASE + path, { waitUntil: 'networkidle0' });
  return p;
}

const PUBLIC = ['/', '/login', '/pricing', '/library', '/leaderboard', '/privacy'];
const APP = ['/dashboard', '/stats', '/saved', '/settings', '/tests', '/profile', '/pricing', '/library', '/leaderboard'];

test('no horizontal overflow at 360, 390 and 430 px', async () => {
  const problems: string[] = [];
  for (const width of [360, 390, 430]) {
    for (const [paths, signedIn] of [[PUBLIC, false], [APP, true]] as const) {
      for (const path of paths) {
        const p = await open(path, width, signedIn);
        const { scroll, client } = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        if (scroll > client) problems.push(`${width}px ${signedIn ? 'app' : 'public'} ${path}: ${scroll} > ${client}`);
        await p.close();
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('tab bar: 4 items, each at least 48px tall and wide, and hidden in a running test', async () => {
  const p = await open('/dashboard', 390, true);
  const sizes = await p.$$eval('nav[aria-label] ul a', (as) => as.map((a) => { const r = a.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  assert.equal(sizes.length, 4);
  for (const [w, h] of sizes) assert.ok(w >= 48 && h >= 48, `tab ${w}x${h}`);
  await p.close();

  const cat = await db.category.findFirstOrThrow({ where: { code: 'B' } });
  const qs = await db.question.findMany({ where: { categoryId: cat.id, ticketNumber: 1 }, select: { id: true } });
  const s = await db.testSession.create({ data: { userId, mode: 'TICKET', categoryId: cat.id, ticketNumber: 1, questionIds: qs.map((q) => q.id), totalQ: qs.length } });
  const t = await open(`/test/${s.id}`, 390, true);
  assert.equal(await t.$('nav[aria-label] ul a[href="/stats"]'), null, 'no tab bar inside a test');
  await t.close();
});
