import type { PrismaClient, TestMode, TestSession, User } from '@prisma/client';
import { db } from './db';
import {
  DAILY_FULL_TEST_LIMIT,
  FULL_TEST_QUESTIONS,
  countFullTestsToday,
  dailyStatus,
  getDailyStatus,
  lockUserForLimit,
  type DailyStatus,
} from './daily-limit';
import { getAccess } from './access';
import { userStats } from './stats';
import { pickAdaptive } from './adaptive';
import { getTrickyQuestions } from './tricky';

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function defaultExamTemplate(categoryId: string) {
  return (
    (await db.examTemplate.findFirst({ where: { categoryId, kind: 'EXAM', isDefault: true } })) ??
    (await db.examTemplate.findFirst({ where: { categoryId, kind: 'EXAM' } })) ?? {
      questionCount: 20,
      timeLimitSec: 1500,
      passPercent: 90,
      topicMix: {},
    }
  );
}

type StartOpts = { mode: TestMode; ticket?: number; topic?: string };
export type StartResult = { ok: true; sessionId: string } | { ok: false; error: 'locked' | 'empty' | 'category' | 'limit' };

const PRACTICE_SIZE = 20;

export async function startTest(user: User, opts: StartOpts): Promise<StartResult> {
  const categoryId = user.categoryId;
  if (!categoryId) return { ok: false, error: 'category' };
  const { active } = await getAccess(user.id);
  const base = { categoryId, isActive: true };

  let questionIds: string[] = [];
  let timeLimitSec: number | undefined;
  let passPercent: number | undefined;
  let topicId: string | undefined;

  switch (opts.mode) {
    case 'TICKET': {
      const ticket = await db.ticket.findUnique({ where: { categoryId_number: { categoryId, number: opts.ticket ?? 1 } } });
      if (!ticket) return { ok: false, error: 'empty' };
      if (!ticket.isFree && !active) return { ok: false, error: 'locked' };
      const qs = await db.question.findMany({ where: { ...base, ticketNumber: ticket.number }, orderBy: { sortOrder: 'asc' }, select: { id: true } });
      questionIds = qs.map((q) => q.id);
      passPercent = (await defaultExamTemplate(categoryId)).passPercent;
      break;
    }
    case 'EXAM': {
      if (!active) return { ok: false, error: 'locked' };
      // Friendly early stop; the binding check happens again when the test is finished.
      if ((await countFullTestsToday(db, user.id)) >= DAILY_FULL_TEST_LIMIT) return { ok: false, error: 'limit' };
      const tpl = await defaultExamTemplate(categoryId);
      timeLimitSec = tpl.timeLimitSec;
      passPercent = tpl.passPercent;
      const mix = (tpl.topicMix ?? {}) as Record<string, number>;
      const picked: string[] = [];
      for (const [slug, count] of Object.entries(mix)) {
        const qs = await db.question.findMany({ where: { ...base, topic: { slug } }, select: { id: true } });
        picked.push(...shuffle(qs.map((q) => q.id)).slice(0, count));
      }
      // A full test is always exactly FULL_TEST_QUESTIONS questions, whatever the template says.
      if (picked.length < FULL_TEST_QUESTIONS) {
        const rest = await db.question.findMany({ where: { ...base, id: { notIn: picked } }, select: { id: true } });
        picked.push(...shuffle(rest.map((q) => q.id)).slice(0, FULL_TEST_QUESTIONS - picked.length));
      }
      questionIds = shuffle(picked).slice(0, FULL_TEST_QUESTIONS);
      if (questionIds.length !== FULL_TEST_QUESTIONS) return { ok: false, error: 'empty' };
      break;
    }
    case 'TOPIC': {
      if (!active) return { ok: false, error: 'locked' };
      const topic = await db.topic.findUnique({ where: { slug: opts.topic ?? '' } });
      if (!topic) return { ok: false, error: 'empty' };
      topicId = topic.id;
      const qs = await db.question.findMany({ where: { ...base, topicId: topic.id }, select: { id: true } });
      questionIds = shuffle(qs.map((q) => q.id));
      break;
    }
    case 'MARATHON': {
      if (!active) return { ok: false, error: 'locked' };
      const qs = await db.question.findMany({ where: base, select: { id: true } });
      questionIds = shuffle(qs.map((q) => q.id));
      break;
    }
    case 'MISTAKES': {
      const due = await db.reviewItem.findMany({
        where: { userId: user.id, question: base },
        orderBy: [{ dueAt: 'asc' }],
        take: PRACTICE_SIZE,
        select: { questionId: true, dueAt: true },
      });
      const now = Date.now();
      const dueFirst = [...due.filter((d) => d.dueAt.getTime() <= now), ...due.filter((d) => d.dueAt.getTime() > now)];
      questionIds = dueFirst.map((d) => d.questionId);
      break;
    }
    case 'ADAPTIVE': {
      if (!active) return { ok: false, error: 'locked' };
      const [stats, all] = await Promise.all([
        userStats(user.id, categoryId),
        db.question.findMany({ where: base, select: { id: true, topicId: true } }),
      ]);
      questionIds = pickAdaptive(all, stats.topics, PRACTICE_SIZE);
      break;
    }
    case 'TRICKY': {
      if (!active) return { ok: false, error: 'locked' };
      questionIds = shuffle((await getTrickyQuestions(categoryId)).ids).slice(0, PRACTICE_SIZE);
      break;
    }
  }

  if (!questionIds.length) return { ok: false, error: 'empty' };

  const s = await db.testSession.create({
    data: {
      userId: user.id,
      mode: opts.mode,
      categoryId,
      topicId,
      ticketNumber: opts.mode === 'TICKET' ? opts.ticket : undefined,
      questionIds,
      totalQ: questionIds.length,
      timeLimitSec,
      passPercent,
    },
  });
  return { ok: true, sessionId: s.id };
}

export type FinishResult =
  | { ok: true; session: TestSession; daily: DailyStatus | null }
  | { ok: false; error: 'daily_limit'; daily: DailyStatus }
  | { ok: false; error: 'invalid_test' };

/**
 * Grades a session from its stored answers (never from client input) and saves the result.
 * Idempotent: finishing an already finished session returns it without counting again.
 * For full tests the daily-limit check and the save run in one transaction under a per-user
 * lock, so retries and concurrent requests can't exceed the limit, and if saving fails
 * nothing is counted. `client` and `now` exist for tests.
 */
export async function finishSession(
  sessionId: string,
  opts: { client?: PrismaClient; now?: Date } = {},
): Promise<FinishResult> {
  const client = opts.client ?? db;
  const now = opts.now ?? new Date();
  const { userId } = await client.testSession.findUniqueOrThrow({ where: { id: sessionId }, select: { userId: true } });

  return client.$transaction(async (tx) => {
    await lockUserForLimit(tx, userId);
    const s = await tx.testSession.findUniqueOrThrow({ where: { id: sessionId }, include: { answers: true } });
    const full = s.mode === 'EXAM';
    if (s.finishedAt) return { ok: true, session: s, daily: full ? await getDailyStatus(tx, userId, now) : null };

    let used = 0;
    if (full) {
      const ids = new Set(s.questionIds);
      if (s.totalQ !== FULL_TEST_QUESTIONS || s.questionIds.length !== FULL_TEST_QUESTIONS || ids.size !== FULL_TEST_QUESTIONS) {
        return { ok: false, error: 'invalid_test' };
      }
      used = await countFullTestsToday(tx, userId, now);
      if (used >= DAILY_FULL_TEST_LIMIT) return { ok: false, error: 'daily_limit', daily: dailyStatus(used, now) };
    }

    // Only answers to this session's own questions can score (the answer API already enforces this).
    const inSession = new Set(s.questionIds);
    const correctQ = s.answers.filter((a) => a.isCorrect && inSession.has(a.questionId)).length;
    const score = s.totalQ ? Math.round((1000 * correctQ) / s.totalQ) / 10 : 0;
    const elapsed = Math.round((now.getTime() - s.startedAt.getTime()) / 1000);
    const timeSpentSec = s.timeLimitSec ? Math.min(elapsed, s.timeLimitSec) : elapsed;
    const graded = full || s.mode === 'TICKET';
    const saved = await tx.testSession.updateMany({
      where: { id: sessionId, finishedAt: null },
      data: { finishedAt: now, correctQ, score, timeSpentSec, passed: graded ? score >= (s.passPercent ?? 90) : null },
    });
    if (saved.count !== 1) throw new Error('Test session changed while it was being finished');
    await tx.user.update({ where: { id: userId }, data: { lastActiveAt: now } });
    const session = await tx.testSession.findUniqueOrThrow({ where: { id: sessionId } });
    return { ok: true, session, daily: full ? dailyStatus(used + 1, now) : null };
  });
}

export function isPracticeMode(mode: TestMode) {
  return mode !== 'EXAM';
}
