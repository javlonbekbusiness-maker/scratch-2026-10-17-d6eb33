/** Minimal RFC 4180 CSV parser/serializer (quoted fields, embedded commas/newlines, "" escapes). */
export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, '');
  // Excel in ru/uz locales saves with ";" — detect from the header line.
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns ?? Object.keys(rows[0] ?? {});
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    // Leading =,+,-,@ would be evaluated as formulas by spreadsheet apps; plain numbers like +998901234567 are safe.
    const safe = /^[=@]|^[+\-](?!\d+(\.\d+)?$)/.test(s) ? `'${s}` : s;
    return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}
