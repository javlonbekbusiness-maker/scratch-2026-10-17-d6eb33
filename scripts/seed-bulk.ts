/**
 * Performance test dataset: 1200+ PLACEHOLDER questions in the shared pool, extra test topics,
 * and benchmark users with realistic answer history. Never use in production.
 *
 *   npm run db:seed-bulk               # add 1250 questions (BULK-0001…) + 30 test topics + 40 bench users
 *   npm run db:seed-bulk -- --count 2000
 *   npm run db:seed-bulk -- --remove   # delete everything this script created
 *
 * Everything is marked: questions have externalId "BULK-…" and text starting "[TEST]", topics have
 * slug "test-topic-…", users are named "[BENCH]" with phones +99899100xxxx. Removal deletes exactly
 * those rows (their answers/sessions cascade) and tickets left empty by the removal.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { assignNewTickets } from '../src/lib/tickets';

const db = new PrismaClient();
const args = process.argv.slice(2);
const COUNT = Number(args[args.indexOf('--count') + 1]) || 1250;
const TEST_TOPICS = 30;
const BENCH_USERS = 40;
const HEAVY_ANSWERS = 3000;
const LIGHT_ANSWERS = 300;
const BENCH_PHONE = '+99899100';

// Small deterministic PRNG so runs are reproducible.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pickN = <T,>(arr: T[], n: number) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
};
const chunk = <T,>(arr: T[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

async function remove() {
  const users = await db.user.deleteMany({ where: { phone: { startsWith: BENCH_PHONE }, name: '[BENCH]' } });
  const questions = await db.question.deleteMany({ where: { externalId: { startsWith: 'BULK-' } } });
  const topics = await db.topic.deleteMany({ where: { slug: { startsWith: 'test-topic-' } } });
  const used = new Set((await db.question.findMany({ where: { ticketNumber: { not: null } }, select: { ticketNumber: true }, distinct: ['ticketNumber'] })).map((q) => q.ticketNumber!));
  const empty = (await db.ticket.findMany({ select: { number: true } })).map((t) => t.number).filter((n) => !used.has(n));
  const tickets = await db.ticket.deleteMany({ where: { number: { in: empty } } });
  console.log(`removed: ${questions.count} questions, ${topics.count} topics, ${users.count} bench users, ${tickets.count} empty tickets`);
}

async function add() {
  if (await db.question.count({ where: { externalId: { startsWith: 'BULK-' } } })) {
    console.log('Bulk data already present; run with --remove first.');
    return;
  }
  const t0 = Date.now();
  for (let i = 1; i <= TEST_TOPICS; i++) {
    const n = String(i).padStart(2, '0');
    await db.topic.upsert({
      where: { slug: `test-topic-${n}` },
      create: { slug: `test-topic-${n}`, nameUz: `[TEST] Mavzu ${n}`, nameRu: `[TEST] Тема ${n}`, icon: '🧪', sortOrder: 100 + i },
      update: {},
    });
  }
  const topicIds = (await db.topic.findMany({ select: { id: true } })).map((t) => t.id);

  const qRows = Array.from({ length: COUNT }, (_, i) => {
    const n = String(i + 1).padStart(4, '0');
    return {
      id: randomUUID(),
      externalId: `BULK-${n}`,
      topicId: topicIds[i % topicIds.length],
      textUz: `[TEST] Namuna savol ${n}: chorrahada kim birinchi o'tadi?`,
      textRu: `[TEST] Пример вопроса ${n}: кто проезжает перекрёсток первым?`,
      explanationUz: '[TEST] Namuna izoh.',
      explanationRu: '[TEST] Пример пояснения.',
      difficulty: 1 + (i % 3),
      isTricky: i % 97 === 0,
    };
  });
  for (const part of chunk(qRows, 500)) await db.question.createMany({ data: part });
  const aRows = qRows.flatMap((q, qi) =>
    [0, 1, 2, 3].map((k) => ({ id: randomUUID(), questionId: q.id, textUz: `Javob ${k + 1}`, textRu: `Ответ ${k + 1}`, isCorrect: k === qi % 4, sortOrder: k })),
  );
  for (const part of chunk(aRows, 2000)) await db.answer.createMany({ data: part });
  const tickets = await assignNewTickets(db);
  console.log(`questions: ${COUNT} (+${aRows.length} answers), tickets created: ${tickets.created} (leftover ${tickets.leftover})`);

  // Bench users with answer history (one heavy user for the per-user timings, the rest feed the leaderboard and trap stats).
  const pool = (await db.question.findMany({ where: { isActive: true }, select: { id: true } })).map((q) => q.id);
  let answers = 0;
  for (let u = 0; u < BENCH_USERS; u++) {
    const n = String(u).padStart(4, '0');
    const user = await db.user.create({
      data: { phone: `${BENCH_PHONE}${n}`, name: '[BENCH]', nickname: `Bench ${n}`, onboarded: true, leaderboardOptIn: true, referralCode: `BENCH${n}${Date.now() % 1e5}` },
    });
    const total = u === 0 ? HEAVY_ANSWERS : LIGHT_ANSWERS;
    const sessions: { id: string; userId: string; mode: 'MARATHON'; questionIds: string[]; totalQ: number; startedAt: Date; finishedAt: Date }[] = [];
    const sa: { sessionId: string; questionId: string; isCorrect: boolean; createdAt: Date }[] = [];
    for (let s = 0; s < total / 20; s++) {
      const qs = pickN(pool, 20);
      const at = new Date(Date.now() - Math.floor(rand() * 30) * 86400_000 - Math.floor(rand() * 86400_000));
      const id = randomUUID();
      sessions.push({ id, userId: user.id, mode: 'MARATHON', questionIds: qs, totalQ: 20, startedAt: at, finishedAt: at });
      for (const q of qs) sa.push({ sessionId: id, questionId: q, isCorrect: rand() < 0.75, createdAt: at });
    }
    await db.testSession.createMany({ data: sessions });
    for (const part of chunk(sa, 2000)) await db.sessionAnswer.createMany({ data: part });
    const wrong = [...new Set(sa.filter((a) => !a.isCorrect).map((a) => a.questionId))].slice(0, 150);
    await db.reviewItem.createMany({ data: wrong.map((questionId) => ({ userId: user.id, questionId })), skipDuplicates: true });
    await db.bookmark.createMany({ data: pickN(pool, 50).map((questionId) => ({ userId: user.id, questionId })), skipDuplicates: true });
    answers += sa.length;
  }
  console.log(`bench users: ${BENCH_USERS}, answers: ${answers}; done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

(args.includes('--remove') ? remove() : add())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
