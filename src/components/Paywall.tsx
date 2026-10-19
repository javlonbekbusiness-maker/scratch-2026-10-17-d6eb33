import Link from 'next/link';
import { getT } from '@/i18n/server';
import { db } from '@/lib/db';
import { formatUzs } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';

/** Upsell shown when a free user opens a premium mode (`?locked=1`). Bottom sheet on phones, dialog on desktop. */
export async function Paywall({ closeHref }: { closeHref?: string }) {
  const { t } = await getT();
  const cheapest = await db.plan.findFirst({ where: { isActive: true }, orderBy: { priceUzs: 'asc' } });
  const features = [t('paywall.f1'), t('paywall.f2'), t('paywall.f3'), t('paywall.f4')];
  const body = (
    <div
      className="w-full max-w-md overflow-hidden rounded-t-card border border-line bg-surface shadow-raised motion-safe:animate-sheet-up sm:rounded-card sm:motion-safe:animate-fade-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-[#2a7be6] px-6 pb-6 pt-7 text-white">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15" aria-hidden><Icon name="lock" /></span>
        <h2 id="paywall-title" className="mt-4 text-h1">{t('paywall.title')}</h2>
        <p className="mt-1 text-white/85">{t('paywall.text')}</p>
      </div>
      <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <ul className="space-y-3">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success/15 text-accent-fg" aria-hidden><Icon name="check" size={16} /></span>
              {f}
            </li>
          ))}
        </ul>
        <Link href="/pricing" className="btn-primary mt-6 w-full" autoFocus>
          {t('paywall.cta')}
          {cheapest && <span className="num font-normal opacity-90">· {t('paywall.from', { price: `${formatUzs(cheapest.priceUzs)} ${t('common.soum')}` })}</span>}
        </Link>
        {closeHref && (
          <Link href={closeHref} className="btn-ghost mt-2 w-full" scroll={false}>
            {t('common.close')}
          </Link>
        )}
      </div>
    </div>
  );
  if (!closeHref) return body;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">{body}</div>;
}
