import type { TestMode, User } from '@prisma/client';
import { db } from './db';
import { getAccess } from './access';
import { userStats } from './stats';
import { pickAdaptive } from './adaptive';

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
export type StartResult = { ok: true; sessionId: string } | { ok: false; error: 'locked' | 'empty' | 'category' };

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
      const tpl = await defaultExamTemplate(categoryId);
      timeLimitSec = tpl.timeLimitSec;
      passPercent = tpl.passPercent;
      const mix = (tpl.topicMix ?? {}) as Record<string, number>;
      const picked: string[] = [];
      for (const [slug, count] of Object.entries(mix)) {
        const qs = await db.question.findMany({ where: { ...base, topic: { slug } }, select: { id: true } });
        picked.push(...shuffle(qs.map((q) => q.id)).slice(0, count));
      }
      if (picked.length < tpl.questionCount) {
        const rest = await db.question.findMany({ where: { ...base, id: { notIn: picked } }, select: { id: true } });
        picked.push(...shuffle(rest.map((q) => q.id)).slice(0, tpl.questionCount - picked.length));
      }
      questionIds = shuffle(picked).slice(0, tpl.questionCount);
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

/** Grades a session from its stored answers. Safe to call more than once. */
export async function finishSession(sessionId: string) {
  const s = await db.testSession.findUniqueOrThrow({ where: { id: sessionId }, include: { answers: true } });
  if (s.finishedAt) return s;
  const correctQ = s.answers.filter((a) => a.isCorrect).length;
  const score = s.totalQ ? Math.round((1000 * correctQ) / s.totalQ) / 10 : 0;
  const elapsed = Math.round((Date.now() - s.startedAt.getTime()) / 1000);
  const timeSpentSec = s.timeLimitSec ? Math.min(elapsed, s.timeLimitSec) : elapsed;
  const graded = s.mode === 'EXAM' || s.mode === 'TICKET';
  const [updated] = await db.$transaction([
    db.testSession.update({
      where: { id: sessionId },
      data: { finishedAt: new Date(), correctQ, score, timeSpentSec, passed: graded ? score >= (s.passPercent ?? 90) : null },
    }),
    db.user.update({ where: { id: s.userId }, data: { lastActiveAt: new Date() } }),
  ]);
  return updated;
}

export function isPracticeMode(mode: TestMode) {
  return mode !== 'EXAM';
}
