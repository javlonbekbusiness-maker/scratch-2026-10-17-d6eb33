import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPhone, isValidPhone, maskLocalDigits, normalizePhone } from '../src/lib/phone';
import { parseCsv, toCsv } from '../src/lib/csv';
import { LOCALES, pick, toLocale } from '../src/i18n/config';
import { THEMES, contrast } from '../src/styles/tokens';
import { readFileSync } from 'node:fs';

test('design tokens: text colours meet WCAG AA (4.5:1) in both themes', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    for (const bg of ['canvas', 'surface', 'raised'] as const) {
      for (const fg of ['ink', 'muted', 'brandFg', 'accentFg', 'danger', 'warning'] as const) {
        const r = contrast(t[fg], t[bg]);
        assert.ok(r >= 4.5, `${name}: ${fg} on ${bg} is ${r.toFixed(2)}:1`);
      }
    }
  }
  assert.ok(contrast('#FFFFFF', '#1F5BEB') >= 4.5, 'white on brand button');
  assert.ok(contrast('#052E1F', '#3ACC95') >= 4.5, 'dark text on accent');
});

test('design tokens: globals.css variables match tokens.ts exactly', () => {
  const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  const block = (sel: string) => css.slice(css.indexOf(`${sel} {`), css.indexOf('}', css.indexOf(`${sel} {`)));
  const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const triplet = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
  for (const [name, sel] of [['light', ':root'], ['dark', '.dark']] as const) {
    const b = block(sel);
    for (const [k, hex] of Object.entries(THEMES[name])) {
      const m = new RegExp(`--c-${kebab(k)}:\\s*([\\d ]+);`).exec(b);
      assert.equal(m?.[1], triplet(hex), `${name} ${k}`);
    }
  }
});
import { formatDuration, formatUzs } from '../src/lib/format';
import { smsSegments } from '../src/lib/sms';
import { flatten, makeT, MESSAGES } from '../src/i18n/translate';
import { pickAdaptive } from '../src/lib/adaptive';
import { sniffImage } from '../src/lib/image-sniff';
import { dailyStatus, tashkentDayRange } from '../src/lib/daily-limit';

test('daily limit: calendar day boundaries are midnight in Asia/Tashkent (UTC+5)', () => {
  // 23:59:59 on 18 Oct in Tashkent is 18:59:59 UTC.
  const lastSecond = tashkentDayRange(new Date('2026-10-18T18:59:59Z'));
  assert.equal(lastSecond.start.toISOString(), '2026-10-17T19:00:00.000Z');
  assert.equal(lastSecond.end.toISOString(), '2026-10-18T19:00:00.000Z');
  // One second later it is 00:00:00 on 19 Oct: a new day.
  const midnight = tashkentDayRange(new Date('2026-10-18T19:00:00Z'));
  assert.equal(midnight.start.toISOString(), '2026-10-18T19:00:00.000Z');
  // Early UTC morning is already afternoon in Tashkent, same day.
  assert.equal(tashkentDayRange(new Date('2026-10-18T00:30:00Z')).start.toISOString(), '2026-10-17T19:00:00.000Z');
  // Month and year rollovers.
  assert.equal(tashkentDayRange(new Date('2026-12-31T19:00:00Z')).start.toISOString(), '2026-12-31T19:00:00.000Z');
  assert.equal(tashkentDayRange(new Date('2026-12-31T18:59:59Z')).start.toISOString(), '2026-12-30T19:00:00.000Z');
});

test('daily limit: remaining count never goes below zero and resets at the next Tashkent midnight', () => {
  const now = new Date('2026-10-18T10:00:00Z');
  assert.deepEqual(dailyStatus(0, now), { used: 0, remaining: 2, limit: 2, resetsAt: new Date('2026-10-18T19:00:00Z') });
  assert.equal(dailyStatus(2, now).remaining, 0);
  assert.equal(dailyStatus(5, now).remaining, 0);
});

test('uploads: images are identified by their bytes, not the declared type', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal(sniffImage(png), 'png');
  assert.equal(sniffImage(jpg), 'jpg');
  assert.equal(sniffImage(webp), 'webp');
  assert.equal(sniffImage(svg), null);
  assert.equal(sniffImage(new Uint8Array()), null);
});

/** Deterministic pseudo-random generator so adaptive tests don't depend on luck. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
const bank = (counts: Record<string, number>) =>
  Object.entries(counts).flatMap(([t, n]) => Array.from({ length: n }, (_, i) => ({ id: `${t}-${i}`, topicId: t })));
const topicOf = (id: string) => id.split('-')[0];

test('adaptive: half the session comes from weak topics, worst first', () => {
  const qs = bank({ signs: 8, priority: 6, speed: 5, parking: 5, lights: 3, safety: 13 });
  const stats = [
    { topicId: 'signs', correct: 3, total: 8, accuracy: 38 },
    { topicId: 'speed', correct: 2, total: 4, accuracy: 50 },
    { topicId: 'safety', correct: 10, total: 10, accuracy: 100 },
  ];
  for (let seed = 1; seed <= 20; seed++) {
    const ids = pickAdaptive(qs, stats, 20, seeded(seed));
    assert.equal(ids.length, 20);
    assert.equal(new Set(ids).size, 20, 'no duplicates');
    const weakCount = ids.filter((id) => ['signs', 'speed'].includes(topicOf(id))).length;
    assert.ok(weakCount >= 10, `seed ${seed}: weak ${weakCount}`);
    const signs = ids.filter((id) => topicOf(id) === 'signs').length;
    assert.ok(signs >= 5, `seed ${seed}: worst topic got ${signs}`);
  }
});

test('adaptive: no history → spread across topics; small bank → all questions', () => {
  const qs = bank({ a: 10, b: 10, c: 10 });
  const ids = pickAdaptive(qs, [], 20, seeded(7));
  assert.equal(ids.length, 20);
  for (const t of ['a', 'b', 'c']) assert.ok(ids.filter((id) => topicOf(id) === t).length >= 3, `topic ${t} present`);
  const small = bank({ a: 2, b: 3 });
  assert.equal(new Set(pickAdaptive(small, [], 20, seeded(3))).size, 5);
});

test('adaptive: a weak topic smaller than its quota does not break the session', () => {
  const qs = bank({ lights: 2, other: 30 });
  const ids = pickAdaptive(qs, [{ topicId: 'lights', correct: 0, total: 5, accuracy: 0 }], 20, seeded(11));
  assert.equal(ids.length, 20);
  assert.equal(ids.filter((id) => topicOf(id) === 'lights').length, 2);
});

test('phone: normalizes and validates Uzbek numbers', () => {
  assert.equal(normalizePhone('+998 90 123-45-67'), '+998901234567');
  assert.equal(normalizePhone('901234567'), '+998901234567');
  assert.ok(isValidPhone('+998901234567'));
  assert.ok(!isValidPhone('+99890123456'));
  assert.ok(!isValidPhone('+79001234567'));
  assert.equal(formatPhone('+998901234567'), '+998 90 123 45 67');
  assert.equal(maskLocalDigits('9012345'), '90 123 45');
});

test('csv: round-trips quotes, commas and newlines; detects semicolons', () => {
  const rows = [{ a: 'x, "y"', b: 'line1\nline2' }];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
  assert.deepEqual(parseCsv('code;value\nABC;10\n'), [{ code: 'ABC', value: '10' }]);
});

test('csv: neutralizes spreadsheet formulas on export', () => {
  assert.match(toCsv([{ a: '=HYPERLINK("x")' }]), /'=HYPERLINK/);
  assert.match(toCsv([{ a: '+SUM(A1)' }]), /'\+SUM/);
  assert.match(toCsv([{ a: '@cmd' }]), /'@cmd/);
  const phone = toCsv([{ p: '+998901234567', n: '-15000' }]);
  assert.ok(phone.includes('\r\n+998901234567,-15000'), phone);
});

test('locales: only Uzbek Latin and Russian; retired Uzbek Cyrillic falls back to Uzbek', () => {
  assert.deepEqual([...LOCALES], ['uz', 'ru']);
  assert.deepEqual(Object.keys(MESSAGES).sort(), ['ru', 'uz']);
  assert.equal(toLocale('uz-Cyrl'), 'uz');
  assert.equal(toLocale('ru'), 'ru');
  assert.equal(toLocale(undefined), 'uz');
  // Content picks never read the old Cyrillic columns, even if a row still has them.
  const row = { textUz: 'Savol', textCy: 'Савол', textRu: 'Вопрос' };
  assert.equal(pick(row, 'text', 'uz'), 'Savol');
  assert.equal(pick(row, 'text', 'ru'), 'Вопрос');
  assert.equal(pick(row, 'text', toLocale('uz-Cyrl')), 'Savol');
});

test('format: money and durations', () => {
  assert.equal(formatUzs(149000), '149 000');
  assert.equal(formatDuration(125), '2:05');
});

test('sms: segment counting for Latin and Cyrillic', () => {
  assert.equal(smsSegments('a'.repeat(160)).segments, 1);
  assert.equal(smsSegments('a'.repeat(161)).segments, 2);
  assert.equal(smsSegments('я'.repeat(70)).segments, 1);
  assert.equal(smsSegments('я'.repeat(71)).encoding, 'UCS-2');
});

test('i18n: every locale has exactly the same keys as uz', () => {
  const base = Object.keys(flatten(MESSAGES.uz)).sort();
  for (const l of ['ru'] as const) assert.deepEqual(Object.keys(flatten(MESSAGES[l])).sort(), base, l);
});

test('i18n: interpolation', () => {
  const t = makeT({ 'a.b': 'Salom, {name}!' });
  assert.equal(t('a.b' as never, { name: 'Ali' }), 'Salom, Ali!');
});
