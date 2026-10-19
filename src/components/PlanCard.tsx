import Link from 'next/link';
import type { PlanView } from '@/lib/plans-view';
import type { TFn } from '@/i18n/translate';
import { formatUzs } from '@/lib/format';
import { Icon } from './ui/Icon';

/** `headingLevel` keeps the page outline correct: 2 directly under a page title, 3 inside a section. */
export function PlanCard({ plan, t, href, cta, active, headingLevel = 3 }: { plan: PlanView; t: TFn; href?: string; cta?: React.ReactNode; active?: boolean; headingLevel?: 2 | 3 }) {
  const perDay = Math.round(plan.finalUzs / plan.durationDays);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div
      className={`card relative flex flex-col p-5 transition hover:border-brand-500/40 ${
        plan.featured ? 'border-2 border-brand-500 shadow-glow' : active ? 'border-2 border-success' : ''
      }`}
    >
      {plan.featured && (
        <span className="chip absolute -top-3 left-5 bg-brand-600 text-white"><Icon name="sparkles" size={14} /> {t('pricing.bestValue')}</span>
      )}
      <Heading className="text-title">{plan.label}</Heading>
      {plan.untilPass && <p className="text-small text-muted">{t('pricing.untilPassNote')}</p>}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="num text-display">{formatUzs(plan.finalUzs)}</span>
        <span className="text-sm text-muted">{t('common.soum')}</span>
      </div>
      {plan.discountPct > 0 && (
        <div className="mt-1 flex items-center gap-2 text-sm">
          <s className="num text-muted">{formatUzs(plan.priceUzs)}</s>
          <span className="chip bg-warning/15 text-warning">−{plan.discountPct}%</span>
        </div>
      )}
      <p className="num mt-1 text-small text-muted">{t('pricing.perDay', { p: `${formatUzs(perDay)} ${t('common.soum')}` })}</p>
      {plan.saving > 0 && <span className="chip mt-3 w-fit bg-success/15 text-accent-fg">{t('pricing.save', { p: plan.saving })}</span>}
      <div className="mt-auto pt-5">
        {cta ??
          (href && (
            <Link href={href} className={plan.featured ? 'btn-primary w-full' : 'btn-secondary w-full'}>
              {t('pricing.choose')}
            </Link>
          ))}
      </div>
    </div>
  );
}
