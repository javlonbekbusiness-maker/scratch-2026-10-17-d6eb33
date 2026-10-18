import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPhone, isValidPhone, maskLocalDigits, normalizePhone } from '../src/lib/phone';
import { parseCsv, toCsv } from '../src/lib/csv';
import { latinToCyrillic } from '../src/lib/translit';
import { formatDuration, formatUzs } from '../src/lib/format';
import { smsSegments } from '../src/lib/sms';
import { flatten, makeT, MESSAGES } from '../src/i18n/translate';
import { pickAdaptive } from '../src/lib/adaptive';
import { sniffImage } from '../src/lib/image-sniff';

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

test('translit: Uzbek Latin to Cyrillic', () => {
  assert.equal(latinToCyrillic("O'zbekiston"), 'Ўзбекистон');
  assert.equal(latinToCyrillic('shahar choyxona'), 'шаҳар чойхона');
  assert.equal(latinToCyrillic("so'm"), 'сўм');
  assert.equal(latinToCyrillic('ekran'), 'экран');
  assert.equal(latinToCyrillic("ma'lumot"), 'маълумот');
});

test('translit: keeps placeholders, URLs and brand words', () => {
  assert.equal(latinToCyrillic('Salom {name}'), 'Салом {name}');
  assert.equal(latinToCyrillic('YHQ Test SMS'), 'YHQ Test SMS');
  assert.equal(latinToCyrillic('https://a.uz/x'), 'https://a.uz/x');
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
  for (const l of ['uz-Cyrl', 'ru'] as const) assert.deepEqual(Object.keys(flatten(MESSAGES[l])).sort(), base, l);
});

test('i18n: interpolation', () => {
  const t = makeT({ 'a.b': 'Salom, {name}!' });
  assert.equal(t('a.b' as never, { name: 'Ali' }), 'Salom, Ali!');
});
