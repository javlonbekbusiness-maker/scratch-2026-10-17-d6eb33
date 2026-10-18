'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type Locale } from '@/i18n/config';
import { useT } from '@/i18n/client';
import { setLocale } from '@/app/actions';

export function LangSwitcher() {
  const { locale, t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="relative">
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => start(async () => { await setLocale(e.target.value as Locale); router.refresh(); })}
        className="h-10 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-7 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900"
        aria-label={t('common.language')}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_SHORT[l]} · {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs">▾</span>
    </label>
  );
}

export function ThemeToggle() {
  const { t } = useT();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-lg dark:border-slate-700 dark:bg-slate-900"
      aria-label={dark ? t('common.lightMode') : t('common.darkMode')}
      title={dark ? t('common.lightMode') : t('common.darkMode')}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
