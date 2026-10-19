import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { progressBy } from '@/lib/progress';
import { startTestAction } from '@/app/actions';
import { ProgressCard } from '@/components/ui/Cards';
import { EmptyState } from '@/components/ui/Primitives';
import { Icon } from '@/components/ui/Icon';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('home.topics'), robots: { index: false } };
}

export default async function TopicsPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const categoryId = user.categoryId!;
  const [access, topics, counts, progress] = await Promise.all([
    getAccess(user.id),
    db.topic.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.question.groupBy({ by: ['topicId'], where: { categoryId, isActive: true, topicId: { not: null } }, _count: true }),
    progressBy(user.id, categoryId, 'topicId'),
  ]);
  const qCount = new Map(counts.map((c) => [c.topicId, c._count]));
  const withQuestions = topics.filter((tp) => (qCount.get(tp.id) ?? 0) > 0);

  return (
    <div className="page space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="grid h-12 w-12 place-items-center rounded-2xl text-muted hover:bg-raised" aria-label={t('common.back')}>
          <Icon name="chevronLeft" />
        </Link>
        <div>
          <h1 className="text-h1">{t('home.topics')}</h1>
          <p className="text-small text-muted">{t('modes.topicDesc')}</p>
        </div>
      </div>

      {withQuestions.length === 0 ? (
        <div className="card"><EmptyState icon="layers" title={t('modes.noQuestions')} /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {withQuestions.map((tp) => {
            const total = qCount.get(tp.id) ?? 0;
            const p = progress.get(tp.id);
            const locked = !access.active;
            const card = (
              <ProgressCard
                lead={tp.icon}
                title={pick(tp, 'name', locale)}
                subtitle={t('modes.qCount', { n: total })}
                progress={{ value: p?.mastered ?? 0, max: total }}
                progressLabel={t('lists.mastered')}
                accuracy={p?.accuracy ?? null}
                accuracyLabel={t('dashboard.accuracy')}
                locked={locked}
                lockedLabel={t('common.locked')}
                {...(locked ? { href: '/tests?locked=1' } : { submit: true as const })}
              />
            );
            return locked ? (
              <div key={tp.id}>{card}</div>
            ) : (
              <form key={tp.id} action={startTestAction} className="h-full">
                <input type="hidden" name="mode" value="TOPIC" />
                <input type="hidden" name="topic" value={tp.slug} />
                {card}
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}
