import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { getSettings } from '@/lib/settings';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { formatDate, formatDuration, formatUzs } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { providerLabel } from '@/lib/payments';
import { markPassed } from '@/app/actions';
import { Icon } from '@/components/ui/Icon';
import { Badge, ButtonLink, EmptyState, ListRow, SectionHeader } from '@/components/ui/Primitives';
import { CopyLink } from './CopyLink';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('profile.title'), robots: { index: false } };
}

export default async function ProfilePage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const [access, settings, invited, rewarded, payments, history, testCount, saved] = await Promise.all([
    getAccess(user.id),
    getSettings(),
    db.user.count({ where: { referredById: user.id } }),
    db.referralReward.count({ where: { referrerId: user.id } }),
    db.payment.findMany({ where: { userId: user.id, status: { in: ['PAID', 'FAILED'] } }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
    db.testSession.findMany({ where: { userId: user.id, finishedAt: { not: null } }, orderBy: { finishedAt: 'desc' }, take: 20 }),
    db.testSession.count({ where: { userId: user.id, finishedAt: { not: null } } }),
    Promise.all([db.bookmark.count({ where: { userId: user.id } }), db.note.count({ where: { userId: user.id } })]),
  ]);
  const modeLabel = (m: string, n: number | null) => (m === 'TICKET' ? t('modes.ticketN', { n: n ?? '' }) : t(`modes.${m.toLowerCase()}` as 'modes.exam'));
  const refUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/?ref=${user.referralCode}`;
  const initial = (user.name ?? '?').trim().slice(0, 1).toUpperCase() || '?';

  return (
    <div className="page max-w-3xl space-y-4">
      <section className="card flex items-center gap-4 p-5" aria-label={t('shell.account')}>
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-600 text-2xl font-bold text-white" aria-hidden>{initial}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-h1">{user.name || t('profile.title')}</h1>
          <p className="num text-small text-muted">{formatPhone(user.phone)}</p>
          <p className="text-small text-muted">{t('profile.memberSince', { date: formatDate(user.createdAt) })}</p>
        </div>
        <Link href="/settings" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line text-muted hover:text-ink" aria-label={t('shell.settings')}>
          <Icon name="settings" />
        </Link>
      </section>

      <section className="card p-5" aria-labelledby="sub-h">
        <SectionHeader id="sub-h" title={t('profile.subscription')} />
        {access.active ? (
          <Badge tone="success"><Icon name="check" size={14} /> {t('dashboard.subscriptionActive', { date: formatDate(access.expiresAt!) })}</Badge>
        ) : (
          <Badge>{t('dashboard.freePlan')}</Badge>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/pricing" icon="card">{access.active ? t('nav.pricing') : t('dashboard.upgrade')}</ButtonLink>
          {!user.passedAt ? (
            <form action={markPassed}><button className="btn-secondary"><Icon name="trophy" size={18} /> {t('profile.iPassed')}</button></form>
          ) : (
            <Badge tone="success"><Icon name="trophy" size={14} /> {t('profile.passedThanks')}</Badge>
          )}
        </div>
      </section>

      <section className="card p-5" aria-labelledby="ref-h">
        <SectionHeader id="ref-h" title={t('profile.referral')} />
        <p className="text-small text-muted">{t('profile.referralText', { p: settings.referralFriendPct, d: settings.referralRewardDays })}</p>
        <CopyLink url={refUrl} labels={{ copy: t('profile.copy'), copied: t('profile.copied'), field: t('profile.referral') }} />
        <p className="num mt-2 text-small text-muted">{t('profile.invited', { n: invited, r: rewarded })}</p>
      </section>

      <section className="card divide-y divide-line overflow-hidden" aria-label={t('shell.saved')}>
        <ListRow icon="bookmark" title={t('profile.bookmarks')} trailing={<span className="num flex items-center gap-2 text-muted">{saved[0]} <Icon name="chevronRight" size={18} /></span>} href="/saved" />
        <ListRow icon="note" title={t('profile.notes')} trailing={<span className="num flex items-center gap-2 text-muted">{saved[1]} <Icon name="chevronRight" size={18} /></span>} href="/saved" />
      </section>

      <section className="card p-5" aria-labelledby="hist-h">
        <SectionHeader id="hist-h" title={`${t('profile.history')} (${testCount})`} />
        {history.length === 0 ? (
          <EmptyState icon="chart" title={t('dashboard.noTests')} action={<ButtonLink href="/tests" variant="secondary" icon="play">{t('dashboard.practice')}</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-line">
            {history.map((r) => {
              const status = r.passed === null ? 'practice' : r.passed ? 'passed' : 'failed';
              return (
                <li key={r.id}>
                  <Link href={`/results/${r.id}`} className="flex min-h-[56px] items-center gap-3 py-2">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${status === 'failed' ? 'bg-danger/10 text-danger' : status === 'passed' ? 'bg-success/15 text-accent-fg' : 'bg-brand-600/15 text-brand-fg'}`}>
                      <Icon name={status === 'failed' ? 'close' : 'check'} size={16} />
                      <span className="sr-only">{status === 'passed' ? t('result.statusPassed') : status === 'failed' ? t('result.statusFailed') : t('result.statusPractice')}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{modeLabel(r.mode, r.ticketNumber)}</span>
                      <span className="num block text-small text-muted">{formatDate(r.finishedAt!)} · {formatDuration(r.timeSpentSec ?? 0)}</span>
                    </span>
                    <span className="num w-12 text-right font-bold">{Math.round(r.score)}%</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="pay-h">
        <SectionHeader id="pay-h" title={t('profile.payments')} />
        {payments.length === 0 ? (
          <p className="text-small text-muted">{t('profile.noPayments')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {payments.map((p) => (
              <li key={p.id} className="flex min-h-[56px] items-center gap-3 py-2">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${p.status === 'PAID' ? 'bg-success/15 text-accent-fg' : 'bg-danger/10 text-danger'}`}>
                  <Icon name={p.status === 'PAID' ? 'check' : 'close'} size={16} />
                  <span className="sr-only">{p.status}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{pick(p.plan, 'label', locale)}</span>
                  <span className="block text-small text-muted">{providerLabel[p.provider]} · {formatDate(p.createdAt)}</span>
                </span>
                <span className="num font-semibold">{formatUzs(p.finalAmountUzs)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
