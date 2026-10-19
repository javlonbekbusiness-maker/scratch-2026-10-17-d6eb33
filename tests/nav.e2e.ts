/**
 * Navigation: every tab and every link on the main app pages leads to a working route.
 * Runs against `npm run dev` (part of `npm run test:e2e`).
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, cleanup, newUser, page } from './helpers';

after(cleanup);

const TABS = ['/dashboard', '/stats', '/saved', '/settings'];

/** Internal hrefs in a page's HTML (ignores assets, API calls, anchors and the logout forms). */
function links(html: string) {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\bhref="(\/[^"#]*)"/g)) {
    const href = m[1].replace(/&amp;/g, '&');
    if (href.startsWith('/_next') || href.startsWith('/api/') || /\.(svg|png|jpg|webp|ico)$/.test(href)) continue;
    out.add(href);
  }
  return [...out];
}

/** Follows same-site redirects; returns the final status. */
async function resolve(path: string, token: string, hops = 5): Promise<{ status: number; path: string }> {
  const r = await page(path, token);
  const loc = r.headers.get('location');
  if (loc && r.status >= 300 && r.status < 400 && hops > 0) {
    const next = new URL(loc, BASE);
    if (next.origin === new URL(BASE).origin) return resolve(next.pathname + next.search, token, hops - 1);
  }
  return { status: r.status, path };
}

test('signed-in pages show the 4 tabs, and every tab marks itself active', async () => {
  const u = await newUser({ subscribed: true });
  for (const tab of TABS) {
    const r = await page(tab, u.token);
    assert.equal(r.status, 200, tab);
    const html = await r.text();
    for (const t of TABS) assert.match(html, new RegExp(`href="${t}"`), `${tab} links to ${t}`);
    assert.match(html, new RegExp(`href="${tab}"[^>]*aria-current="page"|aria-current="page"[^>]*href="${tab}"`), `${tab} is the active tab`);
  }
});

test('every link on the tab pages reaches a working route', async () => {
  const u = await newUser({ subscribed: true });
  const seen = new Map<string, number>();
  for (const tab of TABS) {
    const html = await (await page(tab, u.token)).text();
    for (const href of links(html)) {
      if (seen.has(href)) continue;
      const { status } = await resolve(href, u.token);
      seen.set(href, status);
    }
  }
  const broken = [...seen].filter(([, s]) => s !== 200);
  assert.ok(seen.size >= 8, `crawl found only ${seen.size} links`);
  assert.deepEqual(broken, [], `broken links: ${JSON.stringify(broken)}`);
});

test('visitors get the public header, not the app tabs; app tabs require sign-in', async () => {
  const html = await (await page('/pricing')).text();
  assert.doesNotMatch(html, /href="\/stats"/);
  for (const tab of ['/stats', '/saved', '/settings']) {
    const r = await page(tab);
    assert.equal(r.status, 307, tab);
    assert.match(r.headers.get('location') ?? '', /\/login/);
  }
});
