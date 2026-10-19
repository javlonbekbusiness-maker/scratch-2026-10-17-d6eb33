'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/i18n/client';
import type { MessageKey } from '@/i18n/translate';
import type { ShellNotification } from '@/lib/shell';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { StatChip } from '@/components/ui/Primitives';
import { LangSwitcher, ThemeToggle } from '@/components/HeaderControls';
import { Logo } from '@/components/Logo';

export const NAV: { href: string; icon: IconName; key: MessageKey }[] = [
  { href: '/dashboard', icon: 'home', key: 'shell.home' },
  { href: '/stats', icon: 'chart', key: 'shell.stats' },
  { href: '/saved', icon: 'bookmark', key: 'shell.saved' },
  { href: '/settings', icon: 'settings', key: 'shell.settings' },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(href + '/');

/** A running test gets the whole screen; the result screen keeps the top bar but not the tabs. */
function useChrome() {
  const path = usePathname();
  const inTest = path.startsWith('/test/');
  return { path, inTest, hideTabs: inTest || path.startsWith('/results/') };
}

export function TopBar({ initial, streak, notes }: { initial: string; streak: number; notes: ShellNotification[] }) {
  const { t, locale } = useT();
  const { inTest } = useChrome();
  const [sheet, setSheet] = useState<'search' | 'notes' | null>(null);
  if (inTest) return null;
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'uz-UZ', { day: 'numeric', month: 'long' }) : '');
  const noteText = (n: ShellNotification) =>
    n.kind === 'reviews' ? t('shell.notifReviews', { n: n.n ?? 0 }) : n.kind === 'offer' ? t('shell.notifOffer', { p: n.pct ?? 0 }) : t('shell.notifExpiry', { date: fmt(n.date) });
  const noteIcon: Record<ShellNotification['kind'], IconName> = { reviews: 'mistakes', offer: 'gift', expiry: 'card' };
  const iconBtn = 'relative grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface text-ink pressable hover:border-brand-500/40';

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-2 px-4 sm:px-6">
        <Link href="/profile" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-600 text-lg font-bold text-white pressable" aria-label={t('nav.profile')}>
          {initial}
        </Link>
        <StatChip icon="flame" value={streak} label={t('shell.streak', { n: streak })} tone={streak > 0 ? 'warning' : 'neutral'} />
        <button
          type="button"
          onClick={() => setSheet('search')}
          className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-left text-muted pressable hover:border-brand-500/40"
        >
          <Icon name="search" size={20} />
          <span className="truncate">{t('shell.search')}…</span>
        </button>
        <button type="button" onClick={() => setSheet('notes')} className={iconBtn} aria-label={`${t('shell.notifications')} (${notes.length})`}>
          <Icon name="bell" size={22} />
          {notes.length > 0 && (
            <span className="num absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white dark:text-canvas" aria-hidden>
              {notes.length}
            </span>
          )}
        </button>
      </div>

      <Sheet open={sheet === 'search'} onClose={() => setSheet(null)} title={t('shell.search')}>
        <form action="/library" method="get" role="search" onSubmit={() => setSheet(null)}>
          <label htmlFor="shell-q" className="sr-only">{t('shell.search')}</label>
          <div className="flex gap-2">
            <input id="shell-q" name="q" type="search" autoFocus placeholder={t('shell.searchPlaceholder')} className="input" />
            <button className="btn-primary px-4" aria-label={t('shell.search')}><Icon name="search" size={20} /></button>
          </div>
          <p className="mt-2 text-small text-muted">{t('shell.searchHint')}</p>
        </form>
      </Sheet>

      <Sheet open={sheet === 'notes'} onClose={() => setSheet(null)} title={t('shell.notifications')}>
        {notes.length === 0 ? (
          <p className="py-6 text-center text-muted">{t('shell.noNotifications')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {notes.map((n) => (
              <li key={n.id}>
                <Link href={n.href} onClick={() => setSheet(null)} className="flex min-h-[56px] items-center gap-3 py-2 hover:text-brand-fg">
                  <Icon name={noteIcon[n.kind]} size={20} className="text-muted" />
                  <span className="flex-1 font-medium">{noteText(n)}</span>
                  <Icon name="chevronRight" size={18} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </header>
  );
}

export function BottomTabBar() {
  const { t } = useT();
  const { path, hideTabs } = useChrome();
  if (hideTabs) return null;
  return (
    <>
      <div className="h-tabbar lg:hidden" aria-hidden />
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        aria-label={t('shell.tabs')}
      >
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-4">
          {NAV.map((it) => {
            const active = isActive(path, it.href);
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${active ? 'text-brand-fg' : 'text-muted hover:text-ink'}`}
                >
                  <span className={`grid h-8 w-14 place-items-center rounded-full transition ${active ? 'bg-brand-600/15' : ''}`}>
                    <Icon name={it.icon} size={22} />
                  </span>
                  {t(it.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useT();
  const { path, inTest } = useChrome();
  if (inTest) return null;
  const item = (href: string, icon: IconName, label: string) => {
    const active = isActive(path, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-[48px] items-center gap-3 rounded-2xl px-3 font-semibold transition ${active ? 'bg-brand-600 text-white shadow-glow' : 'text-muted hover:bg-raised hover:text-ink'}`}
      >
        <Icon name={icon} size={22} />
        {label}
      </Link>
    );
  };
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-5 lg:flex" aria-label={t('shell.tabs')}>
      <div className="px-2"><Logo href="/dashboard" /></div>
      <nav className="mt-8 flex flex-col gap-1">
        {NAV.map((it) => item(it.href, it.icon, t(it.key)))}
        <div className="my-3 h-px bg-line" />
        {item('/tests', 'grid', t('nav.tests'))}
        {item('/library', 'book', t('nav.library'))}
        {item('/leaderboard', 'trophy', t('nav.leaderboard'))}
        {item('/pricing', 'card', t('nav.pricing'))}
        {isAdmin && item('/admin', 'shield', t('nav.admin'))}
      </nav>
      <div className="mt-auto flex items-center gap-2 px-1">
        <LangSwitcher />
        <ThemeToggle />
      </div>
    </aside>
  );
}
