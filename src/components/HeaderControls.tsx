'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type Locale } from '@/i18n/config';
import { useT } from '@/i18n/client';
import { setLocale } from '@/app/actions';
import { Icon } from '@/components/ui/Icon';

/** `compact` shows only the language code (for tight headers on phones). */
export function LangSwitcher({ compact = false }: { compact?: boolean }) {
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
        className="h-12 cursor-pointer appearance-none rounded-2xl border border-line bg-raised pl-3 pr-8 text-sm font-semibold text-ink"
        aria-label={t('common.language')}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} title={LOCALE_LABELS[l]}>
            {compact ? LOCALE_SHORT[l] : `${LOCALE_SHORT[l]} · ${LOCALE_LABELS[l]}`}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs">▾</span>
    </label>
  );
}

export function ThemeToggle() {
  const { t } = useT();
  const [dark, setDark] = useState(true);
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
      className="pressable grid h-12 w-12 place-items-center rounded-2xl border border-line bg-raised text-ink hover:border-brand-500/40"
      aria-label={dark ? t('common.lightMode') : t('common.darkMode')}
      title={dark ? t('common.lightMode') : t('common.darkMode')}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={20} />
    </button>
  );
}
