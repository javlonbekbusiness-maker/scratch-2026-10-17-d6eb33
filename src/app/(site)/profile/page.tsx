import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { getSettings } from '@/lib/settings';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { formatDate, formatDuration, formatUzs } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { providerLabel } from '@/lib/payments';
import { logout, logoutEverywhere, markPassed } from '@/app/actions';
import { ProfileForm } from './ProfileForm';
import { CopyLink } from './CopyLink';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('profile.title'), robots: { index: false } };
}

export default async function ProfilePage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const [access, settings, cats, bookmarks, notes, invited, rewarded, payments, history, testCount] = await Promise.all([
    getAccess(user.id),
    getSettings(),
    db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    db.bookmark.findMany({ where: { userId: user.id }, include: { question: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    db.note.findMany({ where: { userId: user.id }, include: { question: true }, orderBy: { updatedAt: 'desc' }, take: 50 }),
    db.user.count({ where: { referredById: user.id } }),
    db.referralReward.count({ where: { referrerId: user.id } }),
    db.payment.findMany({ where: { userId: user.id, status: { in: ['PAID', 'FAILED'] } }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
    db.testSession.findMany({ where: { userId: user.id, finishedAt: { not: null } }, orderBy: { finishedAt: 'desc' }, take: 20 }),
    db.testSession.count({ where: { userId: user.id, finishedAt: { not: null } } }),
  ]);
  const modeLabel = (m: string, n: number | null) => (m === 'TICKET' ? t('modes.ticketN', { n: n ?? '' }) : t(`modes.${m.toLowerCase()}` as 'modes.exam'));
  const refUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/?ref=${user.referralCode}`;

  return (
    <div className="container-app max-w-3xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">{t('profile.title')}</h1>
        <form action={logout}><button className="btn-ghost btn-sm">{t('common.logout')}</button></form>
      </div>

      <section className="card p-5" aria-labelledby="sub-h">
        <h2 id="sub-h" className="font-bold">{t('profile.subscription')}</h2>
        <p className="mt-2">
          {access.active ? (
            <span className="text-mint-700 dark:text-mint-400">✓ {t('dashboard.subscriptionActive', { date: formatDate(access.expiresAt!) })}</span>
          ) : (
            <span className="muted">{t('dashboard.freePlan')}</span>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/pricing" className="btn-cta btn-sm">{access.active ? t('nav.pricing') : t('dashboard.upgrade')}</a>
          {!user.passedAt ? (
            <form action={markPassed}><button className="btn-secondary btn-sm">{t('profile.iPassed')}</button></form>
          ) : (
            <span className="chip bg-mint-500/15 py-2 text-mint-700">🎉 {t('profile.passedThanks')}</span>
          )}
        </div>
      </section>

      <section className="card p-5" aria-labelledby="ref-h">
        <h2 id="ref-h" className="font-bold">🎁 {t('profile.referral')}</h2>
        <p className="mt-1 text-sm muted">{t('profile.referralText', { p: settings.referralFriendPct, d: settings.referralRewardDays })}</p>
        <CopyLink url={refUrl} labels={{ copy: t('profile.copy'), copied: t('profile.copied') }} />
        <p className="mt-2 text-xs muted">{t('profile.invited', { n: invited, r: rewarded })}</p>
      </section>

      <section className="card p-5" aria-labelledby="me-h">
        <h2 id="me-h" className="font-bold">{t('profile.personal')}</h2>
        <p className="mt-1 text-sm muted">
          {formatPhone(user.phone)} · {t('profile.memberSince', { date: formatDate(user.createdAt) })}
        </p>
        <ProfileForm
          user={{ name: user.name ?? '', email: user.email ?? '', categoryId: user.categoryId ?? '', remindSms: user.remindSms, remindEmail: user.remindEmail, remindPush: user.remindPush, leaderboardOptIn: user.leaderboardOptIn }}
          categories={cats.map((c) => ({ id: c.id, label: `${c.code} — ${pick(c, 'name', locale)}` }))}
        />
      </section>

      <section className="card p-5" aria-labelledby="hist-h">
        <h2 id="hist-h" className="font-bold">📊 {t('profile.history')} <span className="font-normal muted">({testCount})</span></h2>
        {history.length === 0 ? <p className="mt-2 text-sm muted">{t('dashboard.noTests')}</p> : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {history.map((r) => (
              <li key={r.id}>
                <a href={`/results/${r.id}`} className="flex items-center gap-3 py-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${r.passed === null ? 'bg-brand-500' : r.passed ? 'bg-mint-500' : 'bg-red-500'}`} />
                  <span className="flex-1 truncate">{modeLabel(r.mode, r.ticketNumber)}</span>
                  <span className="muted">{formatDate(r.finishedAt!)}</span>
                  <span className="tabular-nums muted">{formatDuration(r.timeSpentSec ?? 0)}</span>
                  <span className="w-12 text-right font-bold tabular-nums">{Math.round(r.score)}%</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="bm-h">
        <h2 id="bm-h" className="font-bold">★ {t('profile.bookmarks')}</h2>
        {bookmarks.length === 0 ? <p className="mt-2 text-sm muted">{t('profile.emptyBookmarks')}</p> : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {bookmarks.map((b) => <li key={b.id} className="py-2">{pick(b.question, 'text', locale)}</li>)}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="notes-h">
        <h2 id="notes-h" className="font-bold">📝 {t('profile.notes')}</h2>
        {notes.length === 0 ? <p className="mt-2 text-sm muted">{t('profile.emptyNotes')}</p> : (
          <ul className="mt-3 space-y-3 text-sm">
            {notes.map((n) => (
              <li key={n.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="font-medium">{pick(n.question, 'text', locale)}</p>
                <p className="mt-1 whitespace-pre-line muted">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="pay-h">
        <h2 id="pay-h" className="font-bold">{t('profile.payments')}</h2>
        {payments.length === 0 ? <p className="mt-2 text-sm muted">{t('profile.noPayments')}</p> : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className={`h-2.5 w-2.5 rounded-full ${p.status === 'PAID' ? 'bg-mint-500' : 'bg-red-500'}`} />
                <span className="flex-1">{pick(p.plan, 'label', locale)} · {providerLabel[p.provider]}</span>
                <span className="muted">{formatDate(p.createdAt)}</span>
                <span className="font-semibold tabular-nums">{formatUzs(p.finalAmountUzs)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="sec-h">
        <h2 id="sec-h" className="font-bold">🔒 {t('profile.security')}</h2>
        <p className="mt-1 text-sm muted">{t('profile.logoutAllHint')}</p>
        <form action={logoutEverywhere} className="mt-3"><button className="btn-secondary btn-sm">{t('profile.logoutAll')}</button></form>
      </section>
    </div>
  );
}
