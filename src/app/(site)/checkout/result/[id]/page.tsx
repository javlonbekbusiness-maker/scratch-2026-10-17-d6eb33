import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { getT } from '@/i18n/server';
import { formatDate, formatUzs } from '@/lib/format';
import { Icon, type IconName } from '@/components/ui/Icon';

export const metadata = { robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PaymentResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { t } = await getT();
  const p = await db.payment.findUnique({ where: { id } });
  if (!p || p.userId !== user.id) notFound();
  const access = await getAccess(user.id);

  const views: Record<string, { icon: IconName; title: string; text: string; tile: string }> = {
    PAID: { icon: 'check', title: t('checkout.successTitle'), text: t('checkout.successText', { date: access.expiresAt ? formatDate(access.expiresAt) : '' }), tile: 'bg-success/15 text-accent-fg' },
    FAILED: { icon: 'trap', title: t('checkout.failTitle'), text: t('checkout.failText'), tile: 'bg-danger/10 text-danger' },
    REFUNDED: { icon: 'arrowRight', title: t('checkout.failTitle'), text: '', tile: 'bg-raised text-muted' },
    PENDING: { icon: 'timer', title: t('checkout.pendingTitle'), text: t('checkout.pendingText'), tile: 'bg-brand-600/15 text-brand-fg' },
  };
  const view = views[p.status];

  return (
    <div className="page grid min-h-[60vh] place-items-center">
      {p.status === 'PENDING' && <meta httpEquiv="refresh" content="4" />}
      <div className="card w-full max-w-md motion-safe:animate-fade-up p-8 text-center" role="status">
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${view.tile}`} aria-hidden><Icon name={view.icon} size={32} /></span>
        <h1 className="mt-4 text-h1">{view.title}</h1>
        {view.text && <p className="mt-2 text-muted">{view.text}</p>}
        <p className="mt-4 text-sm text-muted">{t('checkout.amount')}: <b className="num text-ink">{formatUzs(p.finalAmountUzs)} {t('common.soum')}</b></p>
        {p.status === 'PAID' ? (
          <Link href="/dashboard" className="btn-primary mt-6 w-full"><Icon name="play" size={18} /> {t('checkout.startLearning')}</Link>
        ) : p.status === 'FAILED' ? (
          <Link href="/pricing" className="btn-primary mt-6 w-full">{t('nav.pricing')}</Link>
        ) : null}
      </div>
    </div>
  );
}
