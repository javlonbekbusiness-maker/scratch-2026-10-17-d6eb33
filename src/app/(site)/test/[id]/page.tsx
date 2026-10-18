import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { finishSession, isPracticeMode } from '@/lib/tests';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { TestRunner, type RunnerQuestion } from './TestRunner';

export const metadata = { robots: { index: false } };

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { locale, t } = await getT();
  const s = await db.testSession.findUnique({ where: { id }, include: { answers: true } });
  if (!s || s.userId !== user.id) notFound();
  if (s.finishedAt) redirect(`/results/${s.id}`);
  if (s.timeLimitSec && Date.now() - s.startedAt.getTime() > (s.timeLimitSec + 10) * 1000) {
    await finishSession(s.id);
    redirect(`/results/${s.id}`);
  }

  const practice = isPracticeMode(s.mode);
  const [questions, bookmarks, notes] = await Promise.all([
    db.question.findMany({ where: { id: { in: s.questionIds } }, include: { answers: { orderBy: { sortOrder: 'asc' } } } }),
    db.bookmark.findMany({ where: { userId: user.id, questionId: { in: s.questionIds } }, select: { questionId: true } }),
    db.note.findMany({ where: { userId: user.id, questionId: { in: s.questionIds } } }),
  ]);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const bm = new Set(bookmarks.map((b) => b.questionId));
  const noteMap = new Map(notes.map((n) => [n.questionId, n.text]));
  const answered = new Map(s.answers.map((a) => [a.questionId, a]));

  const payload: RunnerQuestion[] = s.questionIds
    .map((qid) => byId.get(qid))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .map((q) => {
      const a = answered.get(q.id);
      return {
        id: q.id,
        text: pick(q, 'text', locale),
        imageUrl: q.imageUrl,
        answers: q.answers.map((x) => ({ id: x.id, text: pick(x, 'text', locale) })),
        bookmarked: bm.has(q.id),
        note: noteMap.get(q.id) ?? '',
        result: a
          ? practice
            ? {
                answerId: a.answerId,
                correct: a.isCorrect,
                correctId: q.answers.find((x) => x.isCorrect)?.id ?? null,
                explanation: pick(q, 'explanation', locale),
                ruleRef: q.ruleRef,
              }
            : { answerId: a.answerId }
          : null,
      };
    });

  const topic = s.mode === 'TOPIC' && s.topicId ? await db.topic.findUnique({ where: { id: s.topicId } }) : null;
  const title =
    s.mode === 'TICKET'
      ? t('modes.ticketN', { n: s.ticketNumber ?? '' })
      : topic
        ? `${topic.icon} ${pick(topic, 'name', locale)}`
        : t(`modes.${s.mode.toLowerCase()}` as 'modes.exam');

  return (
    <TestRunner
      sessionId={s.id}
      title={title}
      practice={practice}
      questions={payload}
      startedAt={s.startedAt.toISOString()}
      timeLimitSec={s.timeLimitSec}
    />
  );
}
