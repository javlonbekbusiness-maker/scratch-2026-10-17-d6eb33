import type { User } from '@prisma/client';
import { getT } from '@/i18n/server';
import { getShellData } from '@/lib/shell';
import { formatDate } from '@/lib/format';
import { BottomTabBar, ShellFrame, Sidebar, TopBar } from './ShellNav';

/** Signed-in layout: sidebar (desktop) or top bar + bottom tabs (phones) around a centred content column. */
export async function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const [{ t }, shell] = await Promise.all([getT(), getShellData(user)]);
  // Texts (with dates) are formatted here on the server, so server and browser render identical HTML.
  const notes = shell.notes.map((n) => ({
    id: n.id,
    kind: n.kind,
    href: n.href,
    text:
      n.kind === 'reviews'
        ? t('shell.notifReviews', { n: n.n ?? 0 })
        : n.kind === 'offer'
          ? t('shell.notifOffer', { p: n.pct ?? 0 })
          : t('shell.notifExpiry', { date: formatDate(new Date(n.date!)) }),
  }));
  return (
    <ShellFrame>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3">
        {t('shell.skip')}
      </a>
      <Sidebar isAdmin={user.role === 'ADMIN'} />
      <TopBar initial={(user.name ?? '?').trim().slice(0, 1).toUpperCase() || '?'} streak={shell.streak} notes={notes} />
      <main id="main">{children}</main>
      <BottomTabBar />
    </ShellFrame>
  );
}
