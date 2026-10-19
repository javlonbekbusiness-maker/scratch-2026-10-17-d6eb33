import type { Metadata } from 'next';
import Link from 'next/link';
import type { TestMode } from '@prisma/client';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { dueCount } from '@/lib/srs';
import { defaultExamTemplate } from '@/lib/tests';
import { FULL_TEST_QUESTIONS, getDailyStatus } from '@/lib/daily-limit';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { startTestAction, setCategory } from '@/app/actions';
import { Paywall } from '@/components/Paywall';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.tests') };
}

export default async function TestsPage({ searchParams }: { searchParams: Promise<{ locked?: string; empty?: string; limit?: string; invalid?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { t, locale } = await getT();
  const categoryId = user.categoryId!;
  const [access, categories, tickets, ticketCounts, topics, topicCounts, due, reviewTotal, exam] = await Promise.all([
    getAccess(user.id),
    db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    db.ticket.findMany({ where: { categoryId }, orderBy: { number: 'asc' } }),
    db.question.groupBy({ by: ['ticketNumber'], where: { categoryId, isActive: true }, _count: true }),
    db.topic.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.question.groupBy({ by: ['topicId'], where: { categoryId, isActive: true }, _count: true }),
    dueCount(user.id),
    db.reviewItem.count({ where: { userId: user.id } }),
    defaultExamTemplate(categoryId),
  ]);
  const daily = await getDailyStatus(db, user.id);
  const locked = !access.active;
  const tCount = new Map(ticketCounts.map((r) => [r.ticketNumber, r._count]));
  const topicCount = new Map(topicCounts.map((r) => [r.topicId, r._count]));
  const lockHref = '/tests?locked=1';

  const modes: { mode: TestMode; icon: string; title: string; desc: string; needsSub: boolean; badge?: string }[] = [
    { mode: 'EXAM', icon: '⏱️', title: t('modes.exam'), desc: t('modes.examDesc', { n: FULL_TEST_QUESTIONS, m: Math.round(exam.timeLimitSec / 60), p: exam.passPercent }), needsSub: true },
    { mode: 'ADAPTIVE', icon: '🧠', title: t('modes.adaptive'), desc: t('modes.adaptiveDesc'), needsSub: true },
    { mode: 'MISTAKES', icon: '🔁', title: t('modes.mistakes'), desc: reviewTotal ? t('dashboard.dueReviews', { n: due || reviewTotal }) : t('modes.noMistakes'), needsSub: false, badge: due ? String(due) : undefined },
    { mode: 'MARATHON', icon: '🏁', title: t('modes.marathon'), desc: t('modes.marathonDesc'), needsSub: true },
  ];

  return (
    <div className="container-app py-8">
      {sp.locked && <Paywall closeHref="/tests" />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">{t('modes.chooseMode')}</h1>
          {sp.empty && <p role="status" className="mt-2 text-sm text-cta-700">{t('modes.noQuestions')}</p>}
          {(sp.limit || daily.remaining === 0) && (
            <p role="status" className="mt-2 rounded-xl bg-cta-500/10 px-3 py-2 text-sm font-medium text-cta-700 dark:text-cta-300">{t('limit.reached', { max: daily.limit })}</p>
          )}
          {sp.invalid && <p role="alert" className="mt-2 text-sm text-red-600">{t('limit.invalid', { n: FULL_TEST_QUESTIONS })}</p>}
        </div>
        <form action={setCategory} className="flex items-center gap-2">
          <label htmlFor="cat" className="text-sm font-medium muted">{t('modes.category')}</label>
          <select id="cat" name="categoryId" defaultValue={categoryId} className="input h-11 min-h-0 w-auto py-0 pr-8">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {pick(c, 'name', locale)}</option>
            ))}
          </select>
          <button className="btn-secondary btn-sm">{t('common.save')}</button>
        </form>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {modes.map((m) => {
          const isLocked = m.needsSub && locked;
          const inner = (
            <>
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-2xl dark:bg-brand-950" aria-hidden>{m.icon}</span>
                {isLocked ? <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">🔒 {t('common.locked')}</span> : m.badge && <span className="chip bg-cta-500 text-white">{m.badge}</span>}
              </div>
              <h2 className="mt-4 text-lg font-bold">{m.title}</h2>
              <p className="mt-1 text-sm muted">{m.desc}</p>
              {m.mode === 'EXAM' && !isLocked && (
                <p className={`mt-2 text-xs font-semibold ${daily.remaining ? 'text-brand-700 dark:text-brand-300' : 'text-cta-700 dark:text-cta-300'}`}>
                  {t('limit.remaining', { n: daily.remaining, max: daily.limit })}
                </p>
              )}
            </>
          );
          const cls = 'card block h-full p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md';
          if (m.mode === 'EXAM' && !isLocked && daily.remaining === 0) {
            return <div key={m.mode} aria-disabled="true" className="card block h-full p-5 opacity-60">{inner}</div>;
          }
          return isLocked ? (
            <Link key={m.mode} href={lockHref} scroll={false} className={cls}>{inner}</Link>
          ) : (
            <form key={m.mode} action={startTestAction}>
              <input type="hidden" name="mode" value={m.mode} />
              <button className={`${cls} w-full`} disabled={m.mode === 'MISTAKES' && !reviewTotal}>{inner}</button>
            </form>
          );
        })}
      </div>

      <section className="mt-10" aria-labelledby="tickets-h">
        <h2 id="tickets-h" className="text-xl font-bold">{t('modes.tickets')}</h2>
        <p className="text-sm muted">{t('modes.ticketDesc')}</p>
        {tickets.length === 0 ? (
          <p className="mt-4 muted">{t('modes.noQuestions')}</p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {tickets.map((tk) => {
              const isLocked = !tk.isFree && locked;
              const label = (
                <>
                  <span className="text-xs muted">{t('modes.ticketN', { n: '' }).trim()}</span>
                  <span className="text-2xl font-extrabold">{tk.number}</span>
                  <span className="text-[11px] muted">{t('modes.qCount', { n: tCount.get(tk.number) ?? 0 })}</span>
                  {tk.isFree && locked && <span className="chip absolute -right-1 -top-2 bg-mint-500 text-white">{t('modes.demo')}</span>}
                  {isLocked && <span className="absolute right-2 top-2 text-sm" aria-label={t('common.locked')}>🔒</span>}
                </>
              );
              const cls = `card relative flex aspect-square flex-col items-center justify-center p-2 transition hover:border-brand-400 ${isLocked ? 'opacity-70' : ''}`;
              return isLocked ? (
                <Link key={tk.id} href={lockHref} scroll={false} className={cls}>{label}</Link>
              ) : (
                <form key={tk.id} action={startTestAction}>
                  <input type="hidden" name="mode" value="TICKET" />
                  <input type="hidden" name="ticket" value={tk.number} />
                  <button className={`${cls} w-full`}>{label}</button>
                </form>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="topics-h">
        <h2 id="topics-h" className="text-xl font-bold">{t('modes.topics')}</h2>
        <p className="text-sm muted">{t('modes.topicDesc')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.filter((tp) => topicCount.get(tp.id)).map((tp) => {
            const inner = (
              <>
                <span className="text-2xl" aria-hidden>{tp.icon}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{pick(tp, 'name', locale)}</span>
                  <span className="text-xs muted">{t('modes.qCount', { n: topicCount.get(tp.id) ?? 0 })}</span>
                </span>
                <span aria-hidden>{locked ? '🔒' : '→'}</span>
              </>
            );
            const cls = 'card flex min-h-[64px] w-full items-center gap-3 p-4 text-left transition hover:border-brand-400';
            return locked ? (
              <Link key={tp.id} href={lockHref} scroll={false} className={cls}>{inner}</Link>
            ) : (
              <form key={tp.id} action={startTestAction}>
                <input type="hidden" name="mode" value="TOPIC" />
                <input type="hidden" name="topic" value={tp.slug} />
                <button className={cls}>{inner}</button>
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}
