export function formatUzs(amount: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(amount)).replace(/ /g, ' ');
}

export function formatDate(d: Date | string, locale = 'uz') {
  const date = typeof d === 'string' ? new Date(d) : d;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  void locale;
  return `${dd}.${mm}.${date.getFullYear()}`;
}

export function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}
