import Link from 'next/link';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { getCurrentUser } from '@/lib/session';
import { activeCampaigns, welcomeOffer } from '@/lib/pricing';
import { Countdown } from './Countdown';
import { Icon } from './ui/Icon';

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
        <Link href="/pricing" className="flex min-h-[40px] items-center justify-center gap-2 bg-[#2b1d05] px-4 py-2 text-center text-sm font-semibold text-[#fbbf24]">
          <Icon name="gift" size={16} /> {t('pricing.welcomeOffer', { p: w.campaign.discountPct })} · <Countdown until={w.endsAt.toISOString()} />
        </Link>
      );
    }
  }

  const seasonal = campaigns.find((c) => c.type === 'SEASONAL' && pick(c, 'banner', locale));
  if (!seasonal) return null;
  return (
    <Link href="/pricing" className="flex min-h-[40px] flex-wrap items-center justify-center gap-x-2 bg-[#2b1d05] px-4 py-2 text-center text-sm font-semibold text-[#fbbf24]">
      <Icon name="gift" size={16} /> {pick(seasonal, 'banner', locale)}
      {seasonal.endsAt && (
        <>
          {' · '}
          <Countdown until={seasonal.endsAt.toISOString()} />
        </>
      )}
    </Link>
  );
}
