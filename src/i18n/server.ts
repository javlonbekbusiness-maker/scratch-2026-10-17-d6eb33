import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';
import { MESSAGES, flatten, makeT } from './translate';
import { db } from '@/lib/db';

export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const al = (await headers()).get('accept-language') ?? '';
  if (/^ru/i.test(al)) return 'ru';
  return DEFAULT_LOCALE;
});

/** Shipped strings merged with admin overrides from the TranslationOverride table. */
export const getDict = cache(async (locale?: Locale) => {
  const l = locale ?? (await getLocale());
  const dict = flatten(MESSAGES[l]);
  try {
    const rows = await db.translationOverride.findMany({ where: { lang: l } });
    for (const r of rows) dict[r.key] = r.value;
  } catch {
    // DB unavailable — fall back to shipped strings.
  }
  return dict;
});

export async function getT() {
  const locale = await getLocale();
  const dict = await getDict(locale);
  return { t: makeT(dict), locale, dict };
}
