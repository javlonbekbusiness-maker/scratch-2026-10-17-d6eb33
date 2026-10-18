export const LOCALES = ['uz', 'uz-Cyrl', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'uz';
export const LOCALE_COOKIE = 'lang';

export const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbekcha",
  'uz-Cyrl': 'Ўзбекча',
  ru: 'Русский',
};

export const LOCALE_SHORT: Record<Locale, string> = { uz: 'UZ', 'uz-Cyrl': 'ЎЗ', ru: 'RU' };

/** Suffix of multilingual DB columns: textUz / textCy / textRu. */
export const FIELD_SUFFIX: Record<Locale, 'Uz' | 'Cy' | 'Ru'> = { uz: 'Uz', 'uz-Cyrl': 'Cy', ru: 'Ru' };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

/** Picks the localized column, e.g. pick(q, 'text', 'ru') → q.textRu, falling back to Uzbek. */
export function pick<T extends object>(obj: T, field: string, locale: Locale): string {
  const o = obj as Record<string, unknown>;
  const v = o[field + FIELD_SUFFIX[locale]];
  return (typeof v === 'string' && v) || (o[field + 'Uz'] as string) || '';
}
