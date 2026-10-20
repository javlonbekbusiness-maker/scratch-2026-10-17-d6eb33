/**
 * Times the queries behind the shared-pool screens for the heaviest bench user
 * (run `npm run db:seed-bulk` first).
 *
 *   npm run bench:pool                   # prints a table
 *   npm run bench:pool -- --json out.json
 *
 * Each query runs 3 warm-up + 15 measured times; median and p95 in milliseconds.
 */
import { writeFileSync } from 'node:fs';
import { db } from '../src/lib/db';
import { progressBy } from '../src/lib/progress';
import { userStats } from '../src/lib/stats';
import { getTrickyQuestions } from '../src/lib/tricky';
import { homeCounts } from '../src/lib/home';
import { recentQuestionIds } from '../src/lib/tests';
import { pickExamQuestions } from '../src/lib/exam-select';
import { pickAdaptive } from '../src/lib/adaptive';
import { dueCount } from '../src/lib/srs';
import { FULL_TEST_QUESTIONS } from '../src/lib/daily-limit';

const RUNS = 15;
const WARMUP = 3;

async function time(fn: () => Promise<unknown>) {
  for (let i = 0; i < WARMUP; i++) await fn();
  const ms: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    await fn();
    ms.push(performance.now() - t);
  }
  ms.sort((a, b) => a - b);
  return { median: ms[Math.floor(ms.length / 2)], p95: ms[Math.min(ms.length - 1, Math.ceil(ms.length * 0.95) - 1)] };
}

async function main() {
  const user = await db.user.findFirst({ where: { name: '[BENCH]' }, orderBy: { phone: 'asc' } });
  if (!user) throw new Error('No bench user. Run `npm run db:seed-bulk` first.');
  const [questions, answers, tickets, topics, mine] = await Promise.all([
    db.question.count({ where: { isActive: true } }),
    db.sessionAnswer.count(),
    db.ticket.count(),
    db.topic.count(),
    db.sessionAnswer.count({ where: { session: { userId: user.id } } }),
  ]);
  const base = { isActive: true };
  const since = new Date(Date.now() - 7 * 86400_000);

  const cases: [string, () => Promise<unknown>][] = [
    ['tickets list: page of 40 + counts', async () => {
      const page = await db.ticket.findMany({ orderBy: { number: 'asc' }, take: 40 });
      await db.question.groupBy({ by: ['ticketNumber'], where: { ...base, ticketNumber: { in: page.map((t) => t.number) } }, _count: true });
    }],
    ['ticket start: questions of one ticket', () => db.question.findMany({ where: { ...base, ticketNumber: 57 }, orderBy: { sortOrder: 'asc' }, select: { id: true } })],
    ['topics list: search + page + counts', async () => {
      const where = { questions: { some: base }, OR: [{ nameUz: { contains: 'mavzu', mode: 'insensitive' as const } }, { nameRu: { contains: 'mavzu', mode: 'insensitive' as const } }] };
      await db.topic.count({ where });
      const page = await db.topic.findMany({ where, orderBy: [{ sortOrder: 'asc' }], take: 24 });
      await db.question.groupBy({ by: ['topicId'], where: { ...base, topicId: { in: page.map((t) => t.id) } }, _count: true });
    }],
    ['progress per ticket (user)', () => progressBy(user.id, 'ticketNumber')],
    ['progress per topic (user)', () => progressBy(user.id, 'topicId')],
    ['exam: pool + recent + pick 20', async () => {
      const [pool, recent] = await Promise.all([db.question.findMany({ where: base, select: { id: true, topicId: true } }), recentQuestionIds(user.id)]);
      pickExamQuestions(pool, recent, FULL_TEST_QUESTIONS);
    }],
    ['marathon: pool + mastered', () => Promise.all([
      db.question.findMany({ where: base, select: { id: true } }),
      db.sessionAnswer.findMany({ where: { session: { userId: user.id }, isCorrect: true }, select: { questionId: true }, distinct: ['questionId'] }),
    ])],
    ['smart practice: stats + pool + pick', async () => {
      const [stats, all] = await Promise.all([userStats(user.id), db.question.findMany({ where: base, select: { id: true, topicId: true } })]);
      pickAdaptive(all, stats.topics, 20);
    }],
    ['mistakes: due review items', () => db.reviewItem.findMany({ where: { userId: user.id, question: base }, orderBy: [{ dueAt: 'asc' }], take: 20 })],
    ['mistakes: due count', () => dueCount(user.id)],
    ['trap questions (all users)', () => getTrickyQuestions()],
    ['statistics: userStats', () => userStats(user.id)],
    ['home counts', () => homeCounts(user)],
    ['bookmarks page', () => db.bookmark.findMany({ where: { userId: user.id }, include: { question: true }, orderBy: { createdAt: 'desc' }, take: 100 })],
    ['leaderboard (7 days)', () => db.$queryRaw`
      SELECT u.id, u.nickname, COUNT(*) FILTER (WHERE a."isCorrect") AS correct
      FROM "SessionAnswer" a JOIN "TestSession" s ON s.id = a."sessionId" JOIN "User" u ON u.id = s."userId"
      WHERE a."createdAt" >= ${since} AND u."leaderboardOptIn" = true
      GROUP BY u.id, u.nickname ORDER BY correct DESC LIMIT 50`],
  ];

  const results: { query: string; median: number; p95: number }[] = [];
  for (const [name, fn] of cases) {
    const r = await time(fn);
    results.push({ query: name, median: +r.median.toFixed(2), p95: +r.p95.toFixed(2) });
  }
  const dataset = { questions, tickets, topics, totalAnswers: answers, benchUserAnswers: mine };
  console.log(`dataset: ${JSON.stringify(dataset)}`);
  console.table(results);
  const out = args.indexOf('--json');
  if (out >= 0) writeFileSync(args[out + 1], JSON.stringify({ dataset, results }, null, 2));
}

const args = process.argv.slice(2);
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
