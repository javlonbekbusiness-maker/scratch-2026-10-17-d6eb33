import Link from 'next/link';
import { getT } from '@/i18n/server';
import { Logo } from './Logo';
import { LangSwitcher, ThemeToggle } from './HeaderControls';

/** Lighter header for visitors (signed-in users get the app shell instead). */
export async function SiteHeader() {
  const { t } = await getT();
  const links = [
    { href: '/#how', label: t('landing.howTitle') },
    { href: '/pricing', label: t('nav.pricing') },
    { href: '/library', label: t('nav.library') },
    { href: '/#faq', label: t('landing.faqTitle') },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="container-app flex h-16 items-center gap-2">
        <Logo href="/" />
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-raised hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="sm:hidden"><LangSwitcher compact /></span>
          <span className="hidden sm:block"><LangSwitcher /></span>
          <span className="hidden sm:block"><ThemeToggle /></span>
          <Link href="/login" className="btn-primary btn-sm min-h-[48px] px-4">
            {t('common.login')}
          </Link>
        </div>
      </div>
    </header>
  );
}
