import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { getCurrentUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { getPlansView } from '@/lib/plans-view';
import { welcomeOffer } from '@/lib/pricing';
import { formatDate } from '@/lib/format';
import { PlanCard } from '@/components/PlanCard';
import { Countdown } from '@/components/Countdown';
import { Icon } from '@/components/ui/Icon';
import { Checkout } from './Checkout';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.pricing'), description: t('pricing.subtitle') };
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ plan?: string; code?: string }> }) {
  const [{ t, locale }, user, sp] = await Promise.all([getT(), getCurrentUser(), searchParams]);
  const plans = await getPlansView(user, locale);
  const [access, welcome] = user ? await Promise.all([getAccess(user.id), welcomeOffer(user)]) : [null, null];
  const featured = plans.find((p) => p.featured) ?? plans[0];

  return (
    <div className="container-app py-10">
      <div className="text-center">
        <h1 className="text-h1 sm:text-[32px] sm:leading-10">{t('pricing.title')}</h1>
        <p className="mt-2 muted">{t('pricing.subtitle')}</p>
        {access?.active && (
          <p className="chip mx-auto mt-4 bg-success/15 py-2 text-sm text-accent-fg">
            <Icon name="check" size={14} /> {t('dashboard.subscriptionActive', { date: formatDate(access.expiresAt!) })}
          </p>
        )}
        {welcome && (
          <p className="mx-auto mt-4 w-fit rounded-2xl flex items-center gap-2 border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-semibold text-ink">
            <Icon name="gift" size={16} className="text-warning" /> {t('pricing.welcomeOffer', { p: welcome.campaign.discountPct })} · {t('pricing.endsIn', { time: '' })}
            <Countdown until={welcome.endsAt.toISOString()} />
          </p>
        )}
      </div>

      {user ? (
        <Checkout
          plans={plans}
          initialPlan={plans.find((p) => p.slug === sp.plan)?.slug ?? featured?.slug ?? ''}
          initialCode={sp.code ?? ''}
        />
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} t={t} headingLevel={2} href={`/login?next=${encodeURIComponent(`/pricing?plan=${p.slug}`)}`} />
          ))}
        </div>
      )}
    </div>
  );
}
