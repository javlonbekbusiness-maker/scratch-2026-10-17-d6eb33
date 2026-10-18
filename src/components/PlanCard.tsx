import Link from 'next/link';
import type { PlanView } from '@/lib/plans-view';
import type { TFn } from '@/i18n/translate';
import { formatUzs } from '@/lib/format';

export function PlanCard({ plan, t, href, cta, active }: { plan: PlanView; t: TFn; href?: string; cta?: React.ReactNode; active?: boolean }) {
  const perDay = Math.round(plan.finalUzs / plan.durationDays);
  return (
    <div
      className={`card relative flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md ${
        plan.featured ? 'border-2 border-brand-500 ring-4 ring-brand-500/10' : active ? 'border-2 border-mint-500' : ''
      }`}
    >
      {plan.featured && (
        <span className="chip absolute -top-3 left-5 bg-brand-600 text-white">⭐ {t('pricing.bestValue')}</span>
      )}
      <h3 className="text-lg font-bold">{plan.label}</h3>
      {plan.untilPass && <p className="text-xs muted">{t('pricing.untilPassNote')}</p>}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums">{formatUzs(plan.finalUzs)}</span>
        <span className="text-sm muted">{t('common.soum')}</span>
      </div>
      {plan.discountPct > 0 && (
        <div className="mt-1 flex items-center gap-2 text-sm">
          <s className="muted tabular-nums">{formatUzs(plan.priceUzs)}</s>
          <span className="chip bg-cta-500/15 text-cta-700 dark:text-cta-400">−{plan.discountPct}%</span>
        </div>
      )}
      <p className="mt-1 text-xs muted">{t('pricing.perDay', { p: `${formatUzs(perDay)} ${t('common.soum')}` })}</p>
      {plan.saving > 0 && <span className="chip mt-3 w-fit bg-mint-500/15 text-mint-700 dark:text-mint-400">{t('pricing.save', { p: plan.saving })}</span>}
      <div className="mt-auto pt-5">
        {cta ??
          (href && (
            <Link href={href} className={plan.featured ? 'btn-cta w-full' : 'btn-secondary w-full'}>
              {t('pricing.choose')}
            </Link>
          ))}
      </div>
    </div>
  );
}
