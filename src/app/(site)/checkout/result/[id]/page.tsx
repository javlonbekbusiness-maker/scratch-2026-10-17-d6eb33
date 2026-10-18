import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { getT } from '@/i18n/server';
import { formatDate, formatUzs } from '@/lib/format';

export const metadata = { robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PaymentResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { t } = await getT();
  const p = await db.payment.findUnique({ where: { id } });
  if (!p || p.userId !== user.id) notFound();
  const access = await getAccess(user.id);

  const view = {
    PAID: { icon: '🎉', title: t('checkout.successTitle'), text: t('checkout.successText', { date: access.expiresAt ? formatDate(access.expiresAt) : '' }), tone: 'text-mint-600' },
    FAILED: { icon: '⚠️', title: t('checkout.failTitle'), text: t('checkout.failText'), tone: 'text-red-600' },
    REFUNDED: { icon: '↩️', title: t('checkout.failTitle'), text: '', tone: 'text-slate-600' },
    PENDING: { icon: '⏳', title: t('checkout.pendingTitle'), text: t('checkout.pendingText'), tone: 'text-brand-600' },
  }[p.status];

  return (
    <div className="container-app grid min-h-[60vh] place-items-center py-10">
      {p.status === 'PENDING' && <meta httpEquiv="refresh" content="4" />}
      <div className="card w-full max-w-md animate-fade-up p-8 text-center">
        <div className="text-5xl" aria-hidden>{view.icon}</div>
        <h1 className={`mt-3 text-2xl font-extrabold ${view.tone}`}>{view.title}</h1>
        <p className="mt-2 muted">{view.text}</p>
        <p className="mt-4 text-sm muted">{t('checkout.amount')}: <b className="tabular-nums">{formatUzs(p.finalAmountUzs)} {t('common.soum')}</b></p>
        {p.status === 'PAID' ? (
          <Link href="/tests" className="btn-cta mt-6 w-full">{t('checkout.startLearning')} →</Link>
        ) : p.status === 'FAILED' ? (
          <Link href="/pricing" className="btn-primary mt-6 w-full">{t('nav.pricing')}</Link>
        ) : null}
      </div>
    </div>
  );
}
