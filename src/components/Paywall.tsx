import Link from 'next/link';
import { getT } from '@/i18n/server';
import { db } from '@/lib/db';
import { formatUzs } from '@/lib/format';

export async function Paywall({ closeHref }: { closeHref?: string }) {
  const { t } = await getT();
  const cheapest = await db.plan.findFirst({ where: { isActive: true }, orderBy: { priceUzs: 'asc' } });
  const features = [t('paywall.f1'), t('paywall.f2'), t('paywall.f3'), t('paywall.f4')];
  const body = (
    <div className="card relative w-full max-w-md animate-fade-up overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="paywall-title">
      <div className="bg-gradient-to-br from-brand-600 to-mint-600 px-6 pb-6 pt-8 text-white">
        <div className="text-4xl" aria-hidden>🔓</div>
        <h2 id="paywall-title" className="mt-3 text-2xl font-extrabold">{t('paywall.title')}</h2>
        <p className="mt-1 text-white/85">{t('paywall.text')}</p>
      </div>
      <div className="p-6">
        <ul className="space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-3">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-mint-500/15 text-sm text-mint-700" aria-hidden>✓</span>
              {f}
            </li>
          ))}
        </ul>
        <Link href="/pricing" className="btn-cta mt-6 w-full">
          {t('paywall.cta')}
          {cheapest && <span className="font-normal opacity-90">· {t('paywall.from', { price: `${formatUzs(cheapest.priceUzs)} ${t('common.soum')}` })}</span>}
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
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      {body}
    </div>
  );
}
