/** Uzbek Latin → Cyrillic transliteration. {placeholders} and protected words are left untouched. */
const PROTECTED = ['YHQ Test', 'Email', 'email', 'SMS', 'Click', 'Payme', 'Uzum', 'PWA', 'AI', 'Telegram', 'Navruz'];

const DIGRAPHS: [RegExp, string][] = [
  [/O[ʻ'‘`]/g, 'Ў'], [/o[ʻ'‘`]/g, 'ў'],
  [/G[ʻ'‘`]/g, 'Ғ'], [/g[ʻ'‘`]/g, 'ғ'],
  [/SH/g, 'Ш'], [/Sh/g, 'Ш'], [/sh/g, 'ш'],
  [/CH/g, 'Ч'], [/Ch/g, 'Ч'], [/ch/g, 'ч'],
  [/YO/g, 'Ё'], [/Yo/g, 'Ё'], [/yo/g, 'ё'],
  [/YU/g, 'Ю'], [/Yu/g, 'Ю'], [/yu/g, 'ю'],
  [/YA/g, 'Я'], [/Ya/g, 'Я'], [/ya/g, 'я'],
  [/YE/g, 'Е'], [/Ye/g, 'Е'], [/ye/g, 'е'],
];

const SINGLE: Record<string, string> = {
  a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н',
  o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'с', w: 'в',
};

function word(w: string) {
  let s = w;
  // Word-initial "e" is "э" in Cyrillic.
  s = s.replace(/^E/, 'Э').replace(/^e/, 'э');
  for (const [re, rep] of DIGRAPHS) s = s.replace(re, rep);
  s = s.replace(/[ʼ’']/g, 'ъ');
  return s.replace(/[A-Za-z]/g, (ch) => {
    const low = SINGLE[ch.toLowerCase()];
    if (!low) return ch;
    return ch === ch.toLowerCase() ? low : low.toUpperCase();
  });
}

export function latinToCyrillic(text: string): string {
  if (!text) return text;
  const tokens = text.split(/(\{[^}]+\}|https?:\/\/\S+)/g);
  return tokens
    .map((tok) => {
      if (/^\{[^}]+\}$/.test(tok) || /^https?:\/\//.test(tok)) return tok;
      const keep: string[] = [];
      let t = tok;
      PROTECTED.forEach((p) => {
        t = t.split(p).join(`\u0000${keep.length}\u0000`);
        keep.push(p);
      });
      t = t.replace(/[A-Za-zʻʼ'‘’`]+/g, word);
      return t.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[Number(i)]);
    })
    .join('');
}
