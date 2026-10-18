/** Adaptive question selection. Pure (no database) so it can be unit-tested. */

export type TopicStat = { topicId: string; correct: number; total: number; accuracy: number };

/** A topic is "weak" once there are enough answers to judge it and accuracy is below this. */
export const WEAK_ACCURACY = 75;
export const MIN_ANSWERS = 3;
/** Share of an adaptive session reserved for weak topics (when the user has any). */
export const WEAK_SHARE = 0.5;

/** Weight for the non-reserved part: unseen topics get a boost, weaker topics more, mastered ones less. */
export function topicWeight(stat: TopicStat | undefined) {
  if (!stat || stat.total < MIN_ANSWERS) return 2;
  return 0.5 + (1 - stat.accuracy / 100) * 4;
}

function shuffled<T>(arr: T[], rand: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks `size` question ids:
 * 1. up to WEAK_SHARE of the session from weak topics, round-robin starting with the worst topic;
 * 2. the rest by weighted random draw over all remaining topics.
 */
export function pickAdaptive(
  questions: { id: string; topicId: string | null }[],
  stats: TopicStat[],
  size: number,
  rand: () => number = Math.random,
): string[] {
  const target = Math.min(size, questions.length);
  const statBy = new Map(stats.map((s) => [s.topicId, s]));
  const pools = new Map<string, string[]>();
  for (const q of shuffled(questions, rand)) {
    const k = q.topicId ?? '_';
    pools.set(k, [...(pools.get(k) ?? []), q.id]);
  }

  const picked: string[] = [];
  const weak = stats
    .filter((s) => s.total >= MIN_ANSWERS && s.accuracy < WEAK_ACCURACY && pools.get(s.topicId)?.length)
    .sort((a, b) => a.accuracy - b.accuracy)
    .map((s) => s.topicId);
  const weakQuota = Math.ceil(target * WEAK_SHARE);
  while (weak.length && picked.length < weakQuota) {
    let progressed = false;
    for (const t of weak) {
      if (picked.length >= weakQuota) break;
      const id = pools.get(t)!.pop();
      if (id) {
        picked.push(id);
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  while (picked.length < target) {
    const avail = [...pools.entries()].filter(([, ids]) => ids.length);
    if (!avail.length) break;
    const weights = avail.map(([t]) => topicWeight(statBy.get(t)));
    let r = rand() * weights.reduce((s, w) => s + w, 0);
    let idx = weights.findIndex((w) => (r -= w) <= 0);
    if (idx < 0) idx = avail.length - 1;
    picked.push(avail[idx][1].pop()!);
  }
  return shuffled(picked, rand);
}
