import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { isSandbox, providerLabel } from '@/lib/payments';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { formatUzs } from '@/lib/format';
import { SandboxButtons } from './SandboxButtons';

export const metadata = { robots: { index: false } };

export default async function SandboxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSandbox()) notFound();
  const user = await requireUser();
  const { t, locale } = await getT();
  const p = await db.payment.findUnique({ where: { id }, include: { plan: true } });
  if (!p || p.userId !== user.id) notFound();
  if (p.status !== 'PENDING') redirect(`/checkout/result/${p.id}`);
  return (
    <div className="container-app grid min-h-[60vh] place-items-center py-10">
      <div className="card w-full max-w-md p-6 text-center">
        <span className="chip bg-warning/15 text-warning">SANDBOX</span>
        <h1 className="mt-3 text-2xl font-bold">{t('checkout.sandboxTitle', { provider: providerLabel[p.provider] })}</h1>
        <p className="mt-1 text-sm muted">{t('checkout.sandboxText')}</p>
        <div className="card-raised my-6 p-4">
          <p className="text-sm muted">{pick(p.plan, 'label', locale)}</p>
          <p className="text-3xl font-extrabold tabular-nums">{formatUzs(p.finalAmountUzs)} {t('common.soum')}</p>
          {p.discountUzs > 0 && <p className="text-sm muted"><s>{formatUzs(p.amountUzs)}</s> · −{formatUzs(p.discountUzs)}</p>}
        </div>
        <SandboxButtons paymentId={p.id} labels={{ ok: t('checkout.simulateSuccess'), fail: t('checkout.simulateFail') }} />
      </div>
    </div>
  );
}
