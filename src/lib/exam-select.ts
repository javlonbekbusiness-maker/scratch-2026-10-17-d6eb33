/**
 * Exam question selection from the shared pool: balanced across topics, never repeating a
 * question within one exam, and avoiding questions the user saw recently where the pool allows.
 * Pure (randomness injected) so it can be tested deterministically.
 */
export type PoolQuestion = { id: string; topicId: string | null };

function shuffled<T>(arr: T[], rand: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Round-robin across topics (topic order shuffled), taking one question per topic per round. */
function roundRobin(groups: string[][], need: number, taken: Set<string>, out: string[]) {
  const queues = groups.map((g) => g.filter((id) => !taken.has(id)));
  let progress = true;
  while (out.length < need && progress) {
    progress = false;
    for (const q of queues) {
      if (out.length >= need) break;
      const id = q.shift();
      if (id !== undefined) {
        out.push(id);
        taken.add(id);
        progress = true;
      }
    }
  }
}

export function pickExamQuestions(pool: PoolQuestion[], recent: Set<string>, count: number, rand: () => number = Math.random) {
  const unique = [...new Map(pool.map((q) => [q.id, q])).values()];
  const byTopic = new Map<string, PoolQuestion[]>();
  for (const q of unique) {
    const k = q.topicId ?? '_none';
    byTopic.set(k, [...(byTopic.get(k) ?? []), q]);
  }
  const topics = shuffled([...byTopic.keys()], rand);
  const fresh = topics.map((k) => shuffled(byTopic.get(k)!.filter((q) => !recent.has(q.id)), rand).map((q) => q.id));
  const seen = topics.map((k) => shuffled(byTopic.get(k)!.filter((q) => recent.has(q.id)), rand).map((q) => q.id));
  const out: string[] = [];
  const taken = new Set<string>();
  roundRobin(fresh, count, taken, out); // 1st choice: questions not seen recently, spread over topics
  roundRobin(seen, count, taken, out); // only if the pool runs short: recently seen ones
  return shuffled(out, rand);
}
