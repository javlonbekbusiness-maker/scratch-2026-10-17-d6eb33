import Link from 'next/link';
import { getT } from '@/i18n/server';
import { getCurrentUser } from '@/lib/session';
import { Logo } from './Logo';
import { LangSwitcher, ThemeToggle } from './HeaderControls';

export async function SiteHeader() {
  const [{ t }, user] = await Promise.all([getT(), getCurrentUser()]);
  const links = user
    ? [
        { href: '/dashboard', label: t('nav.dashboard') },
        { href: '/tests', label: t('nav.tests') },
        { href: '/library', label: t('nav.library') },
        { href: '/leaderboard', label: t('nav.leaderboard') },
        { href: '/pricing', label: t('nav.pricing') },
      ]
    : [
        { href: '/#how', label: t('landing.howTitle') },
        { href: '/pricing', label: t('nav.pricing') },
        { href: '/library', label: t('nav.library') },
        { href: '/#faq', label: t('landing.faqTitle') },
      ];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="container-app flex h-16 items-center gap-3">
        <Logo href={user ? '/dashboard' : '/'} />
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              {l.label}
            </Link>
          ))}
          {user?.role === 'ADMIN' && (
            <Link href="/admin" className="rounded-xl px-3 py-2 text-sm font-medium text-cta-600 hover:bg-slate-100 dark:hover:bg-slate-800">
              {t('nav.admin')}
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LangSwitcher />
          <ThemeToggle />
          {user ? (
            <Link href="/profile" className="hidden h-10 w-10 place-items-center rounded-xl bg-brand-600 font-bold text-white sm:grid" aria-label={t('nav.profile')}>
              {(user.name ?? '?').slice(0, 1).toUpperCase()}
            </Link>
          ) : (
            <Link href="/login" className="btn-primary btn-sm hidden sm:inline-flex">
              {t('common.login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
