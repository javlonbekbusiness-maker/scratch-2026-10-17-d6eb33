import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
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
import { Pager, pageParam } from '@/components/ui/Pager';

const TOPICS_PER_PAGE = 24;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('home.topics'), robots: { index: false } };
}

export default async function TopicsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { t, locale } = await getT();
  const q = (sp.q ?? '').trim().slice(0, 80);

  // Only topics that have active questions; optional name search in both languages.
  const where: Prisma.TopicWhereInput = {
    questions: { some: { isActive: true } },
    ...(q ? { OR: [{ nameUz: { contains: q, mode: 'insensitive' } }, { nameRu: { contains: q, mode: 'insensitive' } }] } : {}),
  };
  const [access, total, allTotals] = await Promise.all([
    getAccess(user.id),
    db.topic.count({ where }),
    db.question.count({ where: { isActive: true, topicId: { not: null } } }),
  ]);
  const { page, pages, skip } = pageParam(sp.page, total, TOPICS_PER_PAGE);
  const topics = await db.topic.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { nameUz: 'asc' }], skip, take: TOPICS_PER_PAGE });
  const ids = topics.map((tp) => tp.id);
  const [counts, progress] = await Promise.all([
    db.question.groupBy({ by: ['topicId'], where: { isActive: true, topicId: { in: ids } }, _count: true }),
    progressBy(user.id, 'topicId'),
  ]);
  const qCount = new Map(counts.map((c) => [c.topicId, c._count]));
  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set('q', q);
    if (p > 1) s.set('page', String(p));
    const str = s.toString();
    return `/tests/topics${str ? `?${str}` : ''}`;
  };

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

      <form role="search" action="/tests/topics" className="flex gap-2">
        <label htmlFor="topic-q" className="sr-only">{t('lists.searchTopics')}</label>
        <div className="relative min-w-0 flex-1">
          <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input id="topic-q" name="q" type="search" defaultValue={q} placeholder={t('lists.searchTopics')} className="input w-full pl-10" maxLength={80} />
        </div>
        <button className="btn-secondary shrink-0">{t('common.search')}</button>
      </form>
      {!q && total > 0 && <p className="text-small text-muted">{t('lists.summary', { n: total, q: allTotals })}</p>}

      {topics.length === 0 ? (
        <div className="card"><EmptyState icon="layers" title={q ? t('lists.noResults') : t('modes.noQuestions')} /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {topics.map((tp) => {
            const n = qCount.get(tp.id) ?? 0;
            const p = progress.get(tp.id);
            const locked = !access.active;
            const card = (
              <ProgressCard
                lead={tp.icon}
                title={pick(tp, 'name', locale)}
                subtitle={t('modes.qCount', { n })}
                progress={{ value: p?.mastered ?? 0, max: n }}
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

      <Pager page={page} pages={pages} href={href} labels={{ prev: t('common.prev'), next: t('common.next'), pageOf: t('lists.pageOf', { page, pages }), nav: t('lists.pager') }} />
    </div>
  );
}
