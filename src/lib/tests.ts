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
import { pickExamQuestions } from './exam-select';
import { QUICK_TOPIC_SIZE, freeTopicQuestions, topicSampleIds } from './topics';

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Exam format (time limit, pass mark). Questions come from the shared pool, so the first default EXAM template applies. */
export async function defaultExamTemplate() {
  return (
    (await db.examTemplate.findFirst({ where: { kind: 'EXAM', isDefault: true }, orderBy: { createdAt: 'asc' } })) ??
    (await db.examTemplate.findFirst({ where: { kind: 'EXAM' }, orderBy: { createdAt: 'asc' } })) ?? {
      questionCount: 20,
      timeLimitSec: 1500,
      passPercent: 90,
      topicMix: {},
    }
  );
}

export type TopicVariant = 'all' | 'mistakes' | 'quick';
type StartOpts = { mode: TestMode; ticket?: number; topic?: string; variant?: TopicVariant };
export type StartResult = { ok: true; sessionId: string } | { ok: false; error: 'locked' | 'empty' | 'limit' };

const PRACTICE_SIZE = 20;
/** A marathon is played in rounds of this many questions, unseen/unmastered ones first. */
export const MARATHON_SIZE = 100;
/** Questions answered within this window count as "just seen" for exam selection. */
const RECENT_DAYS = 3;

/** Question ids the user answered recently (for avoiding repeats in exams). */
export async function recentQuestionIds(userId: string) {
  const rows = await db.sessionAnswer.findMany({
    where: { session: { userId }, createdAt: { gte: new Date(Date.now() - RECENT_DAYS * 86400_000) } },
    select: { questionId: true },
    orderBy: { createdAt: 'desc' },
    take: 600,
  });
  return new Set(rows.map((r) => r.questionId));
}

export async function startTest(user: User, opts: StartOpts): Promise<StartResult> {
  const { active } = await getAccess(user.id);
  // One shared pool for everyone; a saved user category (legacy) is ignored.
  const base = { isActive: true };

  let questionIds: string[] = [];
  let timeLimitSec: number | undefined;
  let passPercent: number | undefined;
  let topicId: string | undefined;
  let isSample = false;

  switch (opts.mode) {
    case 'TICKET': {
      const ticket = await db.ticket.findUnique({ where: { number: opts.ticket ?? 1 } });
      if (!ticket) return { ok: false, error: 'empty' };
      if (!ticket.isFree && !active) return { ok: false, error: 'locked' };
      const qs = await db.question.findMany({ where: { ...base, ticketNumber: ticket.number }, orderBy: { sortOrder: 'asc' }, select: { id: true } });
      questionIds = qs.map((q) => q.id);
      passPercent = (await defaultExamTemplate()).passPercent;
      break;
    }
    case 'EXAM': {
      if (!active) return { ok: false, error: 'locked' };
      // Friendly early stop; the binding check happens again when the test is finished.
      if ((await countFullTestsToday(db, user.id)) >= DAILY_FULL_TEST_LIMIT) return { ok: false, error: 'limit' };
      const [tpl, pool, recent] = await Promise.all([
        defaultExamTemplate(),
        db.question.findMany({ where: base, select: { id: true, topicId: true } }),
        recentQuestionIds(user.id),
      ]);
      timeLimitSec = tpl.timeLimitSec;
      passPercent = tpl.passPercent;
      // A full test is always exactly FULL_TEST_QUESTIONS questions: balanced over topics, no repeats,
      // and questions seen in the last few days only when the pool runs short.
      questionIds = pickExamQuestions(pool, recent, FULL_TEST_QUESTIONS);
      if (questionIds.length !== FULL_TEST_QUESTIONS) return { ok: false, error: 'empty' };
      break;
    }
    case 'TOPIC': {
      const topic = await db.topic.findUnique({ where: { slug: opts.topic ?? '' } });
      if (!topic || !topic.isActive) return { ok: false, error: 'empty' };
      topicId = topic.id;
      if (!active) {
        // Free users get the topic's fixed free sample (admin setting), whatever variant they asked for.
        const n = await freeTopicQuestions();
        if (n === 0) return { ok: false, error: 'locked' };
        questionIds = await topicSampleIds(topic.id, n);
        isSample = true;
        break;
      }
      if (opts.variant === 'mistakes') {
        // The user's open mistakes (Xatolarim) in this topic.
        const due = await db.reviewItem.findMany({ where: { userId: user.id, question: { ...base, topicId: topic.id } }, select: { questionId: true } });
        questionIds = shuffle(due.map((d) => d.questionId));
        break;
      }
      const qs = await db.question.findMany({ where: { ...base, topicId: topic.id }, select: { id: true } });
      questionIds = shuffle(qs.map((q) => q.id));
      if (opts.variant === 'quick') questionIds = questionIds.slice(0, QUICK_TOPIC_SIZE);
      break;
    }
    case 'MARATHON': {
      if (!active) return { ok: false, error: 'locked' };
      // Rounds of MARATHON_SIZE so a 1000+ question pool doesn't load at once; questions the user
      // hasn't answered correctly yet come first, so successive rounds work through the pool.
      const [qs, mastered] = await Promise.all([
        db.question.findMany({ where: base, select: { id: true } }),
        db.sessionAnswer.findMany({ where: { session: { userId: user.id }, isCorrect: true }, select: { questionId: true }, distinct: ['questionId'] }),
      ]);
      const done = new Set(mastered.map((m) => m.questionId));
      const ids = shuffle(qs.map((q) => q.id));
      questionIds = [...ids.filter((id) => !done.has(id)), ...ids.filter((id) => done.has(id))].slice(0, MARATHON_SIZE);
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
        userStats(user.id),
        db.question.findMany({ where: base, select: { id: true, topicId: true } }),
      ]);
      questionIds = pickAdaptive(all, stats.topics, PRACTICE_SIZE);
      break;
    }
    case 'TRICKY': {
      if (!active) return { ok: false, error: 'locked' };
      questionIds = shuffle((await getTrickyQuestions()).ids).slice(0, PRACTICE_SIZE);
      break;
    }
  }

  if (!questionIds.length) return { ok: false, error: 'empty' };

  const s = await db.testSession.create({
    data: {
      userId: user.id,
      mode: opts.mode,
      topicId,
      isSample,
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
