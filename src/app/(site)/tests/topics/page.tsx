import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { User } from '@prisma/client';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { freeTopicQuestions, topicsOverview } from '@/lib/topics';
import { normalizeSearch } from '@/lib/search-normalize';
import { EmptyState, Skeleton } from '@/components/ui/Primitives';
import { TopicsBrowser } from './TopicsBrowser';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('home.topics'), robots: { index: false } };
}

export default async function TopicsPage() {
  // Sign-in check first (a route-level loading.tsx would turn the redirect into a 200), then stream the list.
  const user = await requireUser();
  return (
    <div className="page">
      <Suspense fallback={<TopicsSkeleton />}>
        <TopicsData user={user} />
      </Suspense>
    </div>
  );
}

async function TopicsData({ user }: { user: User }) {
  const { t, locale } = await getT();
  const [{ groups, items }, access, free] = await Promise.all([topicsOverview(user.id), getAccess(user.id), freeTopicQuestions()]);
  if (items.length === 0) return <div className="card"><EmptyState icon="layers" title={t('modes.noQuestions')} /></div>;
  return (
    <TopicsBrowser
      groups={groups.map((g) => ({ id: g.id, name: pick(g, 'name', locale), tone: g.tone }))}
      topics={items.map((tp) => ({
        id: tp.id,
        slug: tp.slug,
        name: pick(tp, 'name', locale),
        search: normalizeSearch(`${tp.nameUz} ${tp.nameRu}`),
        icon: tp.icon,
        groupId: tp.groupId,
        sortOrder: tp.sortOrder,
        createdAt: tp.createdAt,
        total: tp.total,
        answered: tp.answered,
        accuracy: tp.accuracy,
        status: tp.status,
      }))}
      freeQuestions={access.active ? null : free}
    />
  );
}

function TopicsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-12 w-40" />
      <Skeleton className="h-12 w-full" />
      <div className="flex flex-wrap gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-24 rounded-full" />)}</div>
      {[0, 1].map((g) => (
        <div key={g} className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-card" />)}</div>
        </div>
      ))}
    </div>
  );
}
