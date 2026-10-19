/**
 * Language handling after the Uzbek Cyrillic locale was removed (run with `npm run test:e2e`
 * against `npm run dev`). No database writes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const get = (path: string, cookie?: string) => fetch(BASE + path, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });

test('a stored uz-Cyrl language cookie falls back to Uzbek Latin and is replaced', async () => {
  const r = await get('/pricing', 'lang=uz-Cyrl');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<html lang="uz"/);
  assert.match(html, /Tariflar/, 'Uzbek Latin text');
  assert.doesNotMatch(html, /Тарифлар|Ўзбекча/, 'no Uzbek Cyrillic text or option');
  assert.match(r.headers.get('set-cookie') ?? '', /lang=uz;/, 'cookie rewritten to uz');
});

test('even with a Russian browser, a stale uz-Cyrl choice becomes Uzbek Latin', async () => {
  const r = await fetch(BASE + '/pricing', { headers: { Cookie: 'lang=uz-Cyrl', 'Accept-Language': 'ru-RU,ru;q=0.9' } });
  assert.match(await r.text(), /<html lang="uz"/);
});

test('old /uz-Cyrl/... links redirect to the same page without the prefix', async () => {
  for (const [from, to] of [['/uz-Cyrl/pricing', '/pricing'], ['/uz-cyrl', '/'], ['/uz-Cyrl/library?q=stop', '/library?q=stop']]) {
    const r = await get(from);
    assert.equal(r.status, 308, from);
    const loc = new URL(r.headers.get('location')!, BASE);
    assert.equal(loc.pathname + loc.search, to, from);
  }
});

test('Uzbek Latin and Russian still work, and the switcher offers only those two', async () => {
  const uz = await (await get('/pricing', 'lang=uz')).text();
  const ru = await (await get('/pricing', 'lang=ru')).text();
  assert.match(uz, /<html lang="uz"/);
  assert.match(ru, /<html lang="ru"/);
  assert.match(ru, /Тарифы/);
  for (const html of [uz, ru]) {
    assert.match(html, /<option value="uz"/);
    assert.match(html, /<option value="ru"/);
    assert.doesNotMatch(html, /value="uz-Cyrl"|ЎЗ/);
    assert.doesNotMatch(html, /hreflang="uz-Cyrl"/);
  }
});
