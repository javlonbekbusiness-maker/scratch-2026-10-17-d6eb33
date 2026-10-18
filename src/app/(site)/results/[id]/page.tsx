import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { finishSession } from '@/lib/tests';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { formatDuration } from '@/lib/format';
import { startTestAction } from '@/app/actions';
import { ProgressRing } from '@/components/ProgressRing';
import { ShareButton } from './ShareButton';

export const metadata = { robots: { index: false } };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { t, locale } = await getT();
  let s = await db.testSession.findUnique({ where: { id } });
  if (!s || s.userId !== user.id) notFound();
  if (!s.finishedAt) {
    const expired = s.timeLimitSec && Date.now() - s.startedAt.getTime() > s.timeLimitSec * 1000;
    if (!expired) redirect(`/test/${s.id}`);
    s = await finishSession(s.id);
  }

  const [answers, questions] = await Promise.all([
    db.sessionAnswer.findMany({ where: { sessionId: s.id } }),
    db.question.findMany({ where: { id: { in: s.questionIds } }, include: { answers: { orderBy: { sortOrder: 'asc' } } } }),
  ]);
  const ansBy = new Map(answers.map((a) => [a.questionId, a]));
  const qBy = new Map(questions.map((q) => [q.id, q]));
  const wrong = s.questionIds
    .map((qid, i) => ({ q: qBy.get(qid), a: ansBy.get(qid), n: i + 1 }))
    .filter((x) => x.q && !x.a?.isCorrect);

  const graded = s.passed !== null;
  const heading = !graded ? t('result.practiceDone') : s.passed ? t('result.passed') : t('result.failed');
  const tone = !graded ? 'brand' : s.passed ? 'mint' : 'red';

  return (
    <div className="container-app max-w-3xl py-8">
      <section className="card animate-fade-up p-6 text-center sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide muted">{t('result.title')}</p>
        <h1 className={`mt-2 text-3xl font-extrabold ${graded ? (s.passed ? 'text-mint-600' : 'text-red-600') : ''}`}>
          {graded ? (s.passed ? '🎉 ' : '') : ''}
          {heading}
        </h1>
        <div className="mt-6 grid place-items-center">
          <ProgressRing value={s.score} size={180} tone={tone} sub={t('result.correctOf', { c: s.correctQ, n: s.totalQ })} />
        </div>
        <dl className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
            <dt className="muted">{t('result.time')}</dt>
            <dd className="text-lg font-bold tabular-nums">{formatDuration(s.timeSpentSec ?? 0)}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
            <dt className="muted">{t('result.score')}</dt>
            <dd className="text-lg font-bold tabular-nums">{s.score}%</dd>
          </div>
        </dl>
        {s.passPercent && graded && <p className="mt-3 text-xs muted">{t('result.passMark', { p: s.passPercent })}</p>}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <form action={startTestAction}>
            <input type="hidden" name="mode" value={s.mode} />
            {s.ticketNumber && <input type="hidden" name="ticket" value={s.ticketNumber} />}
            {s.topicId && <TopicSlug topicId={s.topicId} />}
            <button className="btn-primary">↻ {t('result.retry')}</button>
          </form>
          <ShareButton
            text={t('result.shareText', { p: s.score })}
            imageUrl={`/api/og/result/${s.id}`}
            labels={{ share: t('result.share'), card: t('result.downloadCard') }}
          />
          {s.mode === 'EXAM' && s.passed && (
            <a href={`/api/og/result/${s.id}?type=cert`} download className="btn-secondary">🏅 {t('result.certificate')}</a>
          )}
          <Link href="/dashboard" className="btn-ghost">{t('result.toDashboard')}</Link>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="mistakes-h">
        <h2 id="mistakes-h" className="text-xl font-bold">{t('result.mistakesTitle')}</h2>
        {wrong.length === 0 ? (
          <p className="card mt-4 p-6 text-center font-semibold text-mint-700">✅ {t('result.allCorrect')}</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {wrong.map(({ q, a, n }) => {
              const yours = q!.answers.find((x) => x.id === a?.answerId);
              const right = q!.answers.find((x) => x.isCorrect);
              return (
                <li key={q!.id} className="card overflow-hidden">
                  {q!.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q!.imageUrl} alt="" loading="lazy" width={640} height={360} className="aspect-video max-h-56 w-full bg-slate-100 object-contain dark:bg-slate-800" />
                  )}
                  <div className="p-5">
                    <p className="font-semibold"><span className="muted">{n}. </span>{pick(q!, 'text', locale)}</p>
                    <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm dark:bg-red-900/20">
                      <span className="font-semibold">❌ {t('result.yourAnswer')}:</span> {yours ? pick(yours, 'text', locale) : t('result.noAnswer')}
                    </p>
                    <p className="mt-2 rounded-xl bg-mint-50 px-3 py-2 text-sm dark:bg-mint-900/20">
                      <span className="font-semibold">✅ {t('result.correctAnswer')}:</span> {right ? pick(right, 'text', locale) : '—'}
                    </p>
                    <p className="mt-3 text-sm">{pick(q!, 'explanation', locale)}</p>
                    {q!.ruleRef && <p className="mt-2 text-xs font-semibold text-brand-700 dark:text-brand-300">📖 {t('test.rule', { ref: q!.ruleRef })}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

async function TopicSlug({ topicId }: { topicId: string }) {
  const tp = await db.topic.findUnique({ where: { id: topicId }, select: { slug: true } });
  return tp ? <input type="hidden" name="topic" value={tp.slug} /> : null;
}
