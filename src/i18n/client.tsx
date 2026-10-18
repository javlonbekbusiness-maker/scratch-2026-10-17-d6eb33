'use client';

import { createContext, useContext, useMemo } from 'react';
import type { Locale } from './config';
import { makeT, type TFn } from './translate';

const Ctx = createContext<{ t: TFn; locale: Locale } | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Record<string, string>; children: React.ReactNode }) {
  const value = useMemo(() => ({ t: makeT(dict), locale }), [dict, locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useT outside I18nProvider');
  return v;
}
