import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { userStats } from '@/lib/stats';
import { dueCount } from '@/lib/srs';
import { defaultExamTemplate } from '@/lib/tests';
import { FULL_TEST_QUESTIONS, getDailyStatus } from '@/lib/daily-limit';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { formatDate, formatDuration } from '@/lib/format';
import { startTestAction } from '@/app/actions';
import { ProgressRing } from '@/components/ProgressRing';
import { Heatmap } from '@/components/Heatmap';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.dashboard'), robots: { index: false } };
}

export default async function Dashboard() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const [stats, access, due, topics, recent, exam, daily] = await Promise.all([
    userStats(user.id, user.categoryId),
    getAccess(user.id),
    dueCount(user.id),
    db.topic.findMany(),
    db.testSession.findMany({ where: { userId: user.id, finishedAt: { not: null } }, orderBy: { finishedAt: 'desc' }, take: 5 }),
    user.categoryId ? defaultExamTemplate(user.categoryId) : null,
    getDailyStatus(db, user.id),
  ]);
  const topicName = new Map(topics.map((tp) => [tp.id, { name: pick(tp, 'name', locale), icon: tp.icon, slug: tp.slug }]));
  const modeLabel = (m: string, n: number | null) => (m === 'TICKET' ? t('modes.ticketN', { n: n ?? '' }) : t(`modes.${m.toLowerCase()}` as 'modes.exam'));

  return (
    <div className="container-app py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t('dashboard.greeting', { name: user.name ?? '' })}</h1>
        {access.active ? (
          <span className="chip bg-mint-500/15 text-sm text-mint-700 dark:text-mint-300">✓ {t('dashboard.subscriptionActive', { date: formatDate(access.expiresAt!) })}</span>
        ) : (
          <Link href="/pricing" className="chip bg-cta-500 py-2 text-sm text-white hover:bg-cta-600">⭐ {t('dashboard.upgrade')}</Link>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Readiness */}
        <section className="card flex flex-col items-center p-6 lg:row-span-2" aria-labelledby="ready-h">
          <h2 id="ready-h" className="self-start font-bold">{t('dashboard.readiness')}</h2>
          <div className="my-4">
            <ProgressRing value={stats.readiness} size={190} stroke={14} tone={stats.readiness >= 85 ? 'mint' : stats.readiness >= 60 ? 'brand' : 'cta'} />
          </div>
          <p className="text-center text-xs muted">{t('dashboard.readinessHint')}</p>
          <dl className="mt-5 grid w-full grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
              <dt className="text-xs muted">{t('dashboard.streak')}</dt>
              <dd className="text-xl font-extrabold">🔥 {stats.streak}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
              <dt className="text-xs muted">{t('dashboard.accuracy')}</dt>
              <dd className="text-xl font-extrabold">{stats.accuracy}%</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
              <dt className="text-xs muted">{t('dashboard.answered')}</dt>
              <dd className="text-xl font-extrabold">{stats.total}</dd>
            </div>
          </dl>
          <div className="mt-5 grid w-full gap-2">
            {access.active ? (
              <form action={startTestAction}>
                <input type="hidden" name="mode" value="EXAM" />
                <button className="btn-cta w-full" disabled={daily.remaining === 0}>⏱ {t('dashboard.startExam')}</button>
              </form>
            ) : (
              <Link href="/tests" className="btn-cta w-full">{t('dashboard.practice')} →</Link>
            )}
            {exam && <p className="text-center text-xs muted">{t('modes.examDesc', { n: FULL_TEST_QUESTIONS, m: Math.round(exam.timeLimitSec / 60), p: exam.passPercent })}</p>}
            {access.active && (
              <p role="status" className={`text-center text-xs font-semibold ${daily.remaining ? 'text-brand-700 dark:text-brand-300' : 'text-cta-700 dark:text-cta-300'}`}>
                {daily.remaining ? t('limit.remaining', { n: daily.remaining, max: daily.limit }) : t('limit.reached', { max: daily.limit })}
              </p>
            )}
          </div>
        </section>

        {/* Quick actions */}
        <section className="card p-6 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <form action={startTestAction}>
              <input type="hidden" name="mode" value="MISTAKES" />
              <button disabled={!due} className="flex w-full items-center gap-3 rounded-2xl bg-cta-500/10 p-4 text-left disabled:opacity-60">
                <span className="text-2xl" aria-hidden>🔁</span>
                <span>
                  <span className="block font-bold">{t('modes.mistakes')}</span>
                  <span className="text-sm muted">{due ? t('dashboard.dueReviews', { n: due }) : t('modes.noMistakes')}</span>
                </span>
              </button>
            </form>
            {access.active ? (
              <form action={startTestAction}>
                <input type="hidden" name="mode" value="ADAPTIVE" />
                <button className="flex w-full items-center gap-3 rounded-2xl bg-brand-500/10 p-4 text-left">
                  <span className="text-2xl" aria-hidden>🧠</span>
                  <span>
                    <span className="block font-bold">{t('modes.adaptive')}</span>
                    <span className="text-sm muted">{t('modes.adaptiveDesc')}</span>
                  </span>
                </button>
              </form>
            ) : (
              <Link href="/tests" className="flex items-center gap-3 rounded-2xl bg-brand-500/10 p-4">
                <span className="text-2xl" aria-hidden>🎟️</span>
                <span>
                  <span className="block font-bold">{t('modes.tickets')}</span>
                  <span className="text-sm muted">{t('dashboard.freePlan')}</span>
                </span>
              </Link>
            )}
          </div>
        </section>

        {/* Topics */}
        <section className="card p-6" aria-labelledby="topics-h">
          <h2 id="topics-h" className="font-bold">{t('dashboard.topicAccuracy')}</h2>
          {stats.topics.length === 0 ? (
            <p className="mt-3 text-sm muted">{t('dashboard.noTests')}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {stats.topics.sort((a, b) => b.total - a.total).slice(0, 6).map((s) => {
                const tp = topicName.get(s.topicId);
                return (
                  <li key={s.topicId}>
                    <div className="flex justify-between text-sm">
                      <span>{tp?.icon} {tp?.name}</span>
                      <span className="font-semibold tabular-nums">{s.accuracy}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-full rounded-full ${s.accuracy >= 85 ? 'bg-mint-500' : s.accuracy >= 60 ? 'bg-brand-500' : 'bg-cta-500'}`} style={{ width: `${s.accuracy}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-6" aria-labelledby="weak-h">
          <h2 id="weak-h" className="font-bold">{t('dashboard.weakTopics')}</h2>
          {stats.weak.length === 0 ? (
            <p className="mt-3 text-sm muted">{t('dashboard.noWeak')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {stats.weak.slice(0, 4).map((s) => {
                const tp = topicName.get(s.topicId)!;
                return (
                  <li key={s.topicId}>
                    <form action={startTestAction}>
                      <input type="hidden" name="mode" value="TOPIC" />
                      <input type="hidden" name="topic" value={tp.slug} />
                      <button className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left hover:border-cta-400 dark:border-slate-700">
                        <span aria-hidden>{tp.icon}</span>
                        <span className="flex-1 text-sm font-semibold">{tp.name}</span>
                        <span className="chip bg-red-500/10 text-red-700 dark:text-red-300">{s.accuracy}%</span>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-6 lg:col-span-2" aria-labelledby="heat-h">
          <h2 id="heat-h" className="mb-4 font-bold">{t('dashboard.activity')}</h2>
          <Heatmap days={stats.heatmap} less={t('dashboard.less')} more={t('dashboard.more')} />
        </section>

        <section className="card p-6" aria-labelledby="recent-h">
          <h2 id="recent-h" className="font-bold">{t('dashboard.recent')}</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm muted">{t('dashboard.noTests')}</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/results/${r.id}`} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className={`h-2.5 w-2.5 rounded-full ${r.passed === null ? 'bg-brand-500' : r.passed ? 'bg-mint-500' : 'bg-red-500'}`} />
                    <span className="flex-1 truncate">{modeLabel(r.mode, r.ticketNumber)}</span>
                    <span className="tabular-nums muted">{formatDuration(r.timeSpentSec ?? 0)}</span>
                    <span className="w-12 text-right font-bold tabular-nums">{Math.round(r.score)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
