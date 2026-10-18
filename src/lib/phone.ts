/** Uzbek mobile numbers: +998 followed by a 2-digit operator code and 7 digits. */
export const PHONE_RE = /^\+998\d{9}$/;

export function normalizePhone(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  return '+' + d;
}

export function isValidPhone(input: string) {
  return PHONE_RE.test(normalizePhone(input));
}

/** "+998901234567" → "+998 90 123 45 67" */
export function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, '').replace(/^998/, '');
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return '+998 ' + parts.join(' ');
}

/** Masks a partially typed number for the input field (digits after +998). */
export function maskLocalDigits(digits: string) {
  const d = digits.replace(/\D/g, '').slice(0, 9);
  const out = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return out.join(' ');
}

export function hidePhone(phone: string) {
  const f = formatPhone(phone);
  return f.slice(0, 8) + ' *** ** ' + f.slice(-2);
}
