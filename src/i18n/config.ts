export const LOCALES = ['uz', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'uz';
export const LOCALE_COOKIE = 'lang';

export const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
};

export const LOCALE_SHORT: Record<Locale, string> = { uz: 'UZ', ru: 'RU' };

/** Suffix of multilingual DB columns: textUz / textRu. */
export const FIELD_SUFFIX: Record<Locale, 'Uz' | 'Ru'> = { uz: 'Uz', ru: 'Ru' };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

/**
 * Any stored or requested language → a supported locale. Retired values such as the old
 * Uzbek Cyrillic "uz-Cyrl" (still in some cookies and User.locale rows) fall back to Uzbek Latin.
 */
export function toLocale(v: unknown): Locale {
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/** Picks the localized column, e.g. pick(q, 'text', 'ru') → q.textRu, falling back to Uzbek. */
export function pick<T extends object>(obj: T, field: string, locale: Locale): string {
  const o = obj as Record<string, unknown>;
  const v = o[field + FIELD_SUFFIX[locale]];
  return (typeof v === 'string' && v) || (o[field + 'Uz'] as string) || '';
}
