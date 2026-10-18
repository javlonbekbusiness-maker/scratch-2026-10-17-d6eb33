/** GSM-7 allows 160 chars per segment (153 when split); anything non-ASCII (e.g. Cyrillic) needs UCS-2: 70 (67). */
export function smsSegments(text: string) {
  const ucs2 = /[^\x00-\x7F]/.test(text);
  const single = ucs2 ? 70 : 160;
  const multi = ucs2 ? 67 : 153;
  const len = [...text].length;
  return { length: len, encoding: ucs2 ? 'UCS-2' : 'GSM-7', segments: len <= single ? 1 : Math.ceil(len / multi), limit: single };
}

/** {placeholders} used in a template body. */
export function templateVars(text: string) {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
}
