import Link from 'next/link';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { getCurrentUser } from '@/lib/session';
import { activeCampaigns, welcomeOffer } from '@/lib/pricing';
import { Countdown } from './Countdown';

export async function CampaignBanner() {
  const [{ t, locale }, user] = await Promise.all([getT(), getCurrentUser()]);
  let campaigns: Awaited<ReturnType<typeof activeCampaigns>> = [];
  try {
    campaigns = await activeCampaigns();
  } catch {
    return null;
  }

  if (user) {
    const w = await welcomeOffer(user, campaigns);
    if (w) {
      return (
        <Link href="/pricing" className="block bg-gradient-to-r from-cta-500 to-cta-600 py-2 text-center text-sm font-semibold text-white">
          🎁 {t('pricing.welcomeOffer', { p: w.campaign.discountPct })} · <Countdown until={w.endsAt.toISOString()} />
        </Link>
      );
    }
  }

  const seasonal = campaigns.find((c) => c.type === 'SEASONAL' && pick(c, 'banner', locale));
  if (!seasonal) return null;
  return (
    <Link href="/pricing" className="block bg-gradient-to-r from-brand-600 to-mint-600 py-2 text-center text-sm font-semibold text-white">
      🎉 {pick(seasonal, 'banner', locale)}
      {seasonal.endsAt && (
        <>
          {' · '}
          <Countdown until={seasonal.endsAt.toISOString()} />
        </>
      )}
    </Link>
  );
}
