import { db } from './db';
import { progressBy, type Progress } from './progress';
import { getSettings } from './settings';

/** Below this accuracy a started topic counts as "weak" (Zaif). */
export const WEAK_TOPIC_ACCURACY = 70;
/** "Tezkor" topic test size. */
export const QUICK_TOPIC_SIZE = 10;

export type TopicStatus = 'new' | 'progress' | 'weak' | 'done';

export function topicStatus(p: Progress | undefined, total: number): TopicStatus {
  if (!p || p.answered === 0) return 'new';
  if (p.accuracy !== null && p.accuracy < WEAK_TOPIC_ACCURACY) return 'weak';
  if (total > 0 && p.answered >= total) return 'done';
  return 'progress';
}

/** How many questions of each topic a free user may try (admin setting). */
export async function freeTopicQuestions() {
  const n = Number((await getSettings()).freeTopicQuestions);
  return Number.isInteger(n) && n >= 0 ? n : 3;
}

/** The free sample of a topic: always the same first questions (by sortOrder, then id). */
export async function topicSampleIds(topicId: string, n: number) {
  if (n <= 0) return [];
  const rows = await db.question.findMany({ where: { topicId, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: n, select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * Everything the topics page needs, from the database: visible groups and topics (topics with
 * no published questions are left out), question counts, and the user's progress per topic.
 */
export async function topicsOverview(userId: string) {
  const [groups, topics, counts, progress] = await Promise.all([
    db.topicGroup.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { nameUz: 'asc' }] }),
    db.topic.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { nameUz: 'asc' }] }),
    db.question.groupBy({ by: ['topicId'], where: { isActive: true, topicId: { not: null } }, _count: true }),
    progressBy(userId, 'topicId'),
  ]);
  const count = new Map(counts.map((c) => [c.topicId!, c._count]));
  const activeGroups = new Set(groups.map((g) => g.id));
  const items = topics
    .filter((t) => (count.get(t.id) ?? 0) > 0 && (!t.groupId || activeGroups.has(t.groupId)))
    .map((t) => {
      const total = count.get(t.id)!;
      const p = progress.get(t.id);
      return {
        id: t.id,
        slug: t.slug,
        nameUz: t.nameUz,
        nameRu: t.nameRu,
        icon: t.icon,
        groupId: t.groupId,
        sortOrder: t.sortOrder,
        createdAt: t.createdAt.toISOString(),
        total,
        answered: Math.min(p?.answered ?? 0, total),
        accuracy: p?.accuracy ?? null,
        status: topicStatus(p, total),
      };
    });
  return { groups, items };
}
