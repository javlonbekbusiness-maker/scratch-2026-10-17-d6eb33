import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { userStats } from '@/lib/stats';
import { formatDuration } from '@/lib/format';
import { startTestAction } from '@/app/actions';
import { ProgressRing } from '@/components/ProgressRing';
import { Heatmap } from '@/components/Heatmap';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ProgressBar, SectionHeader, StatChip, ButtonLink } from '@/components/ui/Primitives';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('shell.stats'), robots: { index: false } };
}

export default async function StatsPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const [stats, topics, recent] = await Promise.all([
    userStats(user.id, user.categoryId),
    db.topic.findMany(),
    db.testSession.findMany({ where: { userId: user.id, finishedAt: { not: null } }, orderBy: { finishedAt: 'desc' }, take: 8 }),
  ]);
  const topicName = new Map(topics.map((tp) => [tp.id, { name: pick(tp, 'name', locale), icon: tp.icon, slug: tp.slug }]));
  const modeLabel = (m: string, n: number | null) => (m === 'TICKET' ? t('modes.ticketN', { n: n ?? '' }) : t(`modes.${m.toLowerCase()}` as 'modes.exam'));

  if (stats.total === 0) {
    return (
      <div className="page">
        <h1 className="mb-4 text-h1">{t('shell.stats')}</h1>
        <div className="card">
          <EmptyState icon="chart" title={t('dashboard.noTests')} text={t('stats.emptyText')} action={<ButtonLink href="/tests" icon="play">{t('dashboard.practice')}</ButtonLink>} />
        </div>
      </div>
    );
  }

  return (
    <div className="page space-y-4">
      <h1 className="text-h1">{t('shell.stats')}</h1>

      <section className="card grid items-center gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-6" aria-labelledby="ready-h">
        <div className="mx-auto">
          <ProgressRing value={stats.readiness} size={168} stroke={14} tone={stats.readiness >= 85 ? 'mint' : 'brand'} />
        </div>
        <div>
          <h2 id="ready-h" className="text-h2">{t('dashboard.readiness')}</h2>
          <p className="mt-1 text-small text-muted">{t('dashboard.readinessHint')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatChip icon="flame" value={stats.streak} label={t('dashboard.streak')} tone="warning" />
            <StatChip icon="target" value={`${stats.accuracy}%`} label={t('dashboard.accuracy')} tone="success" />
            <StatChip icon="check" value={stats.total} label={t('dashboard.answered')} tone="brand" />
            <StatChip icon="layers" value={`${stats.coverage}%`} label={t('stats.coverage')} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="topics-h">
          <SectionHeader id="topics-h" title={t('dashboard.topicAccuracy')} />
          <ul className="space-y-4">
            {[...stats.topics].sort((a, b) => b.total - a.total).map((s) => {
              const tp = topicName.get(s.topicId);
              return (
                <li key={s.topicId}>
                  <div className="mb-1.5 flex justify-between gap-2 text-sm">
                    <span className="truncate">{tp?.icon} {tp?.name}</span>
                    <span className="num font-semibold">{s.accuracy}% <span className="font-normal text-muted">· {s.total}</span></span>
                  </div>
                  <ProgressBar value={s.accuracy} label={tp?.name ?? ''} tone={s.accuracy >= 85 ? 'accent' : s.accuracy >= 60 ? 'brand' : 'warning'} />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-5" aria-labelledby="weak-h">
          <SectionHeader id="weak-h" title={t('dashboard.weakTopics')} />
          {stats.weak.length === 0 ? (
            <p className="text-small text-muted">{t('dashboard.noWeak')}</p>
          ) : (
            <ul className="space-y-2">
              {stats.weak.slice(0, 5).map((s) => {
                const tp = topicName.get(s.topicId)!;
                return (
                  <li key={s.topicId}>
                    <form action={startTestAction}>
                      <input type="hidden" name="mode" value="TOPIC" />
                      <input type="hidden" name="topic" value={tp.slug} />
                      <button className="pressable flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-line bg-raised px-4 text-left hover:border-brand-500/40">
                        <span aria-hidden>{tp.icon}</span>
                        <span className="flex-1 font-semibold">{tp.name}</span>
                        <span className="num chip bg-danger/10 text-danger">{s.accuracy}%</span>
                        <Icon name="play" size={18} className="text-brand-fg" />
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-5" aria-labelledby="heat-h">
        <SectionHeader id="heat-h" title={t('dashboard.activity')} />
        <Heatmap days={stats.heatmap} less={t('dashboard.less')} more={t('dashboard.more')} />
      </section>

      <section className="card p-5" aria-labelledby="recent-h">
        <SectionHeader id="recent-h" title={t('dashboard.recent')} action={<Link href="/profile" className="text-sm font-semibold text-brand-fg hover:underline">{t('profile.history')}</Link>} />
        <ul className="divide-y divide-line">
          {recent.map((r) => {
            const ok = r.passed !== false;
            return (
              <li key={r.id}>
                <Link href={`/results/${r.id}`} className="flex min-h-[56px] items-center gap-3 py-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-full ${r.passed === null ? 'bg-brand-600/15 text-brand-fg' : ok ? 'bg-success/15 text-accent-fg' : 'bg-danger/10 text-danger'}`}>
                    <Icon name={r.passed === null ? 'check' : ok ? 'check' : 'close'} size={16} />
                    <span className="sr-only">{r.passed === null ? '' : ok ? t('result.passed') : t('result.failed')}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{modeLabel(r.mode, r.ticketNumber)}</span>
                  <span className="num text-small text-muted">{formatDuration(r.timeSpentSec ?? 0)}</span>
                  <span className="num w-12 text-right font-bold">{Math.round(r.score)}%</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
