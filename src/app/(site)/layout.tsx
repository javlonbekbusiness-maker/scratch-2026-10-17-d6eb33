import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { BottomNav } from '@/components/BottomNav';
import { CampaignBanner } from '@/components/CampaignBanner';
import { getCurrentUser } from '@/lib/session';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <CampaignBanner />
      <SiteHeader />
      <main id="main" className={user ? 'pb-24 md:pb-10' : ''}>
        {children}
      </main>
      <SiteFooter />
      {user && <BottomNav />}
    </>
  );
}
