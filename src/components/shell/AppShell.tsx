import type { User } from '@prisma/client';
import { getT } from '@/i18n/server';
import { getShellData } from '@/lib/shell';
import { BottomTabBar, Sidebar, TopBar } from './ShellNav';

/** Signed-in layout: sidebar (desktop) or top bar + bottom tabs (phones) around a centred content column. */
export async function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const [{ t }, shell] = await Promise.all([getT(), getShellData(user)]);
  return (
    <div className="min-h-dvh lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3">
        {t('shell.skip')}
      </a>
      <Sidebar isAdmin={user.role === 'ADMIN'} />
      <TopBar initial={(user.name ?? '?').trim().slice(0, 1).toUpperCase() || '?'} streak={shell.streak} notes={shell.notes} />
      <main id="main">{children}</main>
      <BottomTabBar />
    </div>
  );
}
