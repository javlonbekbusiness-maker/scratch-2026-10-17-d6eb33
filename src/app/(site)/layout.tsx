import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CampaignBanner } from '@/components/CampaignBanner';
import { AppShell } from '@/components/shell/AppShell';
import { getCurrentUser } from '@/lib/session';
import { getT } from '@/i18n/server';

/** Signed-in users get the app shell on every page; visitors get the lighter public header and footer. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, { t }] = await Promise.all([getCurrentUser(), getT()]);
  if (user) return <AppShell user={user}>{children}</AppShell>;
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3">
        {t('shell.skip')}
      </a>
      <CampaignBanner />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
