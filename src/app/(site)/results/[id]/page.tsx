import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { finishSession } from '@/lib/tests';
import { getDailyStatus } from '@/lib/daily-limit';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { formatDuration } from '@/lib/format';
import { startTestAction } from '@/app/actions';
import { ProgressRing } from '@/components/ProgressRing';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, SectionHeader } from '@/components/ui/Primitives';
import { ShareButton } from './ShareButton';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('result.title'), robots: { index: false } };
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { t, locale } = await getT();
  let s = await db.testSession.findUnique({ where: { id } });
  if (!s || s.userId !== user.id) notFound();
  if (!s.finishedAt) {
    const expired = s.timeLimitSec && Date.now() - s.startedAt.getTime() > s.timeLimitSec * 1000;
    if (!expired) redirect(`/test/${s.id}`);
    const r = await finishSession(s.id);
    if (!r.ok) redirect(`/tests?${r.error === 'daily_limit' ? 'limit' : 'invalid'}=1`);
    s = r.session;
  }
  const daily = s.mode === 'EXAM' ? await getDailyStatus(db, user.id) : null;

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
  const state = !graded ? 'practice' : s.passed ? 'passed' : 'failed';
  const heading = { practice: t('result.practiceDone'), passed: t('result.passed'), failed: t('result.failed') }[state];
  const look = {
    practice: { ring: 'brand' as const, icon: 'check' as const, chip: 'bg-brand-600/15 text-brand-fg' },
    passed: { ring: 'mint' as const, icon: 'trophy' as const, chip: 'bg-success/15 text-accent-fg' },
    failed: { ring: 'red' as const, icon: 'close' as const, chip: 'bg-danger/10 text-danger' },
  }[state];
  const modeLabel = s.mode === 'TICKET' ? t('modes.ticketN', { n: s.ticketNumber ?? '' }) : t(`modes.${s.mode.toLowerCase()}` as 'modes.exam');

  return (
    <div className="page max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="grid h-12 w-12 place-items-center rounded-2xl text-muted hover:bg-raised" aria-label={t('result.toDashboard')}>
          <Icon name="chevronLeft" />
        </Link>
        <p className="text-small text-muted">{t('result.title')} · {modeLabel}</p>
      </div>

      <section className="card motion-safe:animate-fade-up p-5 text-center sm:p-8" aria-labelledby="res-h">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${look.chip}`}>
          <Icon name={look.icon} size={16} />
          {state === 'passed' ? t('result.statusPassed') : state === 'failed' ? t('result.statusFailed') : t('result.statusPractice')}
        </span>
        <h1 id="res-h" className="mt-3 text-h1">{heading}</h1>
        <div className="mt-6 grid place-items-center">
          <ProgressRing value={s.score} size={184} stroke={14} tone={look.ring} sub={t('result.correctOf', { c: s.correctQ, n: s.totalQ })} />
        </div>
        <dl className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2">
          {[
            [t('result.time'), formatDuration(s.timeSpentSec ?? 0), 'timer'],
            [t('result.correctShort'), `${s.correctQ}/${s.totalQ}`, 'check'],
            [t('result.mistakesShort'), String(wrong.length), 'close'],
          ].map(([k, v, icon]) => (
            <div key={k} className="card-raised p-3">
              <dt className="flex items-center justify-center gap-1 text-small text-muted"><Icon name={icon as 'timer'} size={14} /> {k}</dt>
              <dd className="num mt-1 text-h2">{v}</dd>
            </div>
          ))}
        </dl>
        {s.passPercent && graded && <p className="mt-3 text-small text-muted">{t('result.passMark', { p: s.passPercent })}</p>}
        {daily && (
          <p role="status" className={`mt-3 text-sm font-medium ${daily.remaining ? 'text-muted' : 'text-warning'}`}>
            {daily.remaining ? t('limit.remaining', { n: daily.remaining, max: daily.limit }) : t('limit.reached', { max: daily.limit })}
          </p>
        )}

        <div className="mt-6 grid gap-2 sm:flex sm:flex-wrap sm:justify-center">
          {daily?.remaining !== 0 && (
            <form action={startTestAction} className="sm:contents">
              <input type="hidden" name="mode" value={s.mode} />
              {s.ticketNumber && <input type="hidden" name="ticket" value={s.ticketNumber} />}
              {s.topicId && <TopicSlug topicId={s.topicId} />}
              <button className="btn-primary w-full sm:w-auto"><Icon name="play" size={18} /> {t('result.retry')}</button>
            </form>
          )}
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <ShareButton text={t('result.shareText', { p: s.score })} imageUrl={`/api/og/result/${s.id}`} labels={{ share: t('result.share'), card: t('result.downloadCard') }} />
          </div>
          {s.mode === 'EXAM' && s.passed && (
            <a href={`/api/og/result/${s.id}?type=cert`} download className="btn-success"><Icon name="trophy" size={18} /> {t('result.certificate')}</a>
          )}
          <Link href="/dashboard" className="btn-ghost">{t('result.toDashboard')}</Link>
        </div>
      </section>

      <section aria-labelledby="mistakes-h">
        <SectionHeader id="mistakes-h" title={`${t('result.mistakesTitle')} (${wrong.length})`} />
        {wrong.length === 0 ? (
          <div className="card"><EmptyState icon="check" title={t('result.allCorrect')} /></div>
        ) : (
          <ol className="space-y-3">
            {wrong.map(({ q, a, n }) => {
              const yours = q!.answers.find((x) => x.id === a?.answerId);
              const right = q!.answers.find((x) => x.isCorrect);
              return (
                <li key={q!.id} className="card overflow-hidden">
                  {q!.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q!.imageUrl} alt="" loading="lazy" decoding="async" width={640} height={360} className="aspect-video max-h-56 w-full bg-raised object-contain" />
                  )}
                  <div className="p-4 sm:p-5">
                    <p className="font-semibold"><span className="num text-muted">{n}. </span>{pick(q!, 'text', locale)}</p>
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm">
                      <Icon name="close" size={18} className="mt-px text-danger" />
                      <span><span className="font-semibold">{t('result.yourAnswer')}:</span> {yours ? pick(yours, 'text', locale) : t('result.noAnswer')}</span>
                    </p>
                    <p className="mt-2 flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm">
                      <Icon name="check" size={18} className="mt-px text-accent-fg" />
                      <span><span className="font-semibold">{t('result.correctAnswer')}:</span> {right ? pick(right, 'text', locale) : '—'}</span>
                    </p>
                    {pick(q!, 'explanation', locale) && <p className="mt-3 text-sm text-ink">{pick(q!, 'explanation', locale)}</p>}
                    {q!.ruleRef && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-fg"><Icon name="book" size={14} /> {t('test.rule', { ref: q!.ruleRef })}</p>}
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
