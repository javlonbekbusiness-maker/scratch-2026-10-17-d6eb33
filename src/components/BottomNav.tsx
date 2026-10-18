'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/i18n/client';

const items = [
  { href: '/dashboard', icon: '🏠', key: 'nav.dashboard' },
  { href: '/tests', icon: '📝', key: 'nav.tests' },
  { href: '/library', icon: '🚸', key: 'nav.library' },
  { href: '/profile', icon: '👤', key: 'nav.profile' },
] as const;

/** Thumb-friendly tab bar for signed-in users on phones. Hidden during a test. */
export function BottomNav() {
  const path = usePathname();
  const { t } = useT();
  if (path.startsWith('/test/')) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/95"
      aria-label="Tabs"
    >
      <ul className="grid grid-cols-4">
        {items.map((it) => {
          const active = path === it.href || path.startsWith(it.href + '/');
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500'}`}
              >
                <span className="text-xl" aria-hidden>{it.icon}</span>
                {t(it.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
