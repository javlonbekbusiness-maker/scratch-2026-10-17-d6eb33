import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { dueCount } from '@/lib/srs';
import { defaultExamTemplate } from '@/lib/tests';
import { FULL_TEST_QUESTIONS, getDailyStatus } from '@/lib/daily-limit';
import { getTrickyQuestions } from '@/lib/tricky';
import { progressBy } from '@/lib/progress';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { startTestAction, setCategory } from '@/app/actions';
import { Paywall } from '@/components/Paywall';
import { ActionCard, WideCard } from '@/components/ui/Cards';
import { Icon } from '@/components/ui/Icon';
import { SectionHeader } from '@/components/ui/Primitives';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.tests') };
}

export default async function TestsPage({ searchParams }: { searchParams: Promise<{ locked?: string; empty?: string; limit?: string; invalid?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { t, locale } = await getT();
  const categoryId = user.categoryId!;
  const [access, categories, due, reviewTotal, exam, daily, tricky, ticketTotals, topicTotals, ticketProgress, topicProgress] = await Promise.all([
    getAccess(user.id),
    db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    dueCount(user.id),
    db.reviewItem.count({ where: { userId: user.id } }),
    defaultExamTemplate(categoryId),
    getDailyStatus(db, user.id),
    getTrickyQuestions(categoryId),
    db.question.groupBy({ by: ['ticketNumber'], where: { categoryId, isActive: true, ticketNumber: { not: null } }, _count: true }),
    db.question.groupBy({ by: ['topicId'], where: { categoryId, isActive: true, topicId: { not: null } }, _count: true }),
    progressBy(user.id, categoryId, 'ticketNumber'),
    progressBy(user.id, categoryId, 'topicId'),
  ]);
  const locked = !access.active;
  const lockHref = '/tests?locked=1';
  const sum = (m: Map<string, { mastered: number }>) => [...m.values()].reduce((a, p) => a + p.mastered, 0);
  const ticketQ = ticketTotals.reduce((a, r) => a + r._count, 0);
  const topicQ = topicTotals.reduce((a, r) => a + r._count, 0);

  const mode = (m: string, card: React.ReactNode) => (
    <form action={startTestAction} className="h-full">
      <input type="hidden" name="mode" value={m} />
      {card}
    </form>
  );

  return (
    <div className="page space-y-5">
      {sp.locked && <Paywall closeHref="/tests" />}
      <div>
        <h1 className="text-h1">{t('nav.tests')}</h1>
        <p className="mt-1 text-small text-muted">{t('modes.chooseMode')}</p>
      </div>

      {sp.empty && <p role="status" className="card-raised flex items-center gap-2 px-4 py-3 text-sm"><Icon name="trap" size={18} className="text-warning" /> {t('modes.noQuestions')}</p>}
      {(sp.limit || daily.remaining === 0) && (
        <p role="status" className="flex items-start gap-2 rounded-tile border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-medium text-ink">
          <Icon name="timer" size={18} className="mt-px text-warning" /> {t('limit.reached', { max: daily.limit })}
        </p>
      )}
      {sp.invalid && <p role="alert" className="rounded-tile border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{t('limit.invalid', { n: FULL_TEST_QUESTIONS })}</p>}

      <form action={setCategory} className="card grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <label htmlFor="cat" className="flex items-center gap-2 font-semibold"><Icon name="card" size={20} className="text-muted" /> {t('modes.category')}</label>
        <div className="flex gap-2 sm:contents">
          <select id="cat" name="categoryId" defaultValue={categoryId} className="input min-w-0 flex-1 pr-8">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {pick(c, 'name', locale)}</option>
            ))}
          </select>
          <button className="btn-secondary shrink-0">{t('common.save')}</button>
        </div>
      </form>

      <section aria-labelledby="modes-h">
        <SectionHeader id="modes-h" title={t('tests.modes')} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {locked ? (
            <ActionCard icon="timer" tone="violet" title={t('modes.exam')} subtitle={t('modes.examDesc', { n: FULL_TEST_QUESTIONS, m: Math.round(exam.timeLimitSec / 60), p: exam.passPercent })} locked lockedLabel={t('common.locked')} href={lockHref} />
          ) : daily.remaining === 0 ? (
            <ActionCard icon="timer" tone="violet" title={t('modes.exam')} subtitle={t('home.examLimit')} soon={t('tests.limitChip')} />
          ) : (
            mode('EXAM', <ActionCard icon="timer" tone="violet" title={t('modes.exam')} subtitle={t('limit.remaining', { n: daily.remaining, max: daily.limit })} submit />)
          )}
          {locked ? (
            <ActionCard icon="sparkles" title={t('modes.adaptive')} subtitle={t('modes.adaptiveDesc')} locked lockedLabel={t('common.locked')} href={lockHref} />
          ) : (
            mode('ADAPTIVE', <ActionCard icon="sparkles" title={t('modes.adaptive')} subtitle={t('modes.adaptiveDesc')} submit />)
          )}
          <ActionCard
            icon="trap"
            tone="warning"
            title={t('home.tricky')}
            subtitle={tricky.ids.length ? t('home.trickySub', { n: tricky.ids.length }) : t('home.trickyNone')}
            locked={locked}
            lockedLabel={t('common.locked')}
            href="/tests/tricky"
          />
          {reviewTotal ? (
            mode('MISTAKES', <ActionCard icon="mistakes" tone="danger" title={t('modes.mistakes')} subtitle={due ? t('home.mistakesDue', { n: due }) : t('home.mistakesLater')} badge={due} submit />)
          ) : (
            <ActionCard icon="mistakes" tone="danger" title={t('modes.mistakes')} subtitle={t('modes.noMistakes')} href="/stats" />
          )}
          {locked ? (
            <ActionCard icon="flame" tone="accent" title={t('modes.marathon')} subtitle={t('modes.marathonDesc')} locked lockedLabel={t('common.locked')} href={lockHref} />
          ) : (
            mode('MARATHON', <ActionCard icon="flame" tone="accent" title={t('modes.marathon')} subtitle={t('modes.marathonDesc')} submit />)
          )}
        </div>
      </section>

      <section aria-labelledby="lists-h">
        <SectionHeader id="lists-h" title={t('tests.lists')} />
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <WideCard
            icon="ticket"
            title={t('home.tickets')}
            subtitle={t('tests.masteredOf', { n: sum(ticketProgress), total: ticketQ })}
            href="/tests/tickets"
          />
          <WideCard
            icon="layers"
            tone="accent"
            title={t('home.topics')}
            subtitle={t('tests.masteredOf', { n: sum(topicProgress), total: topicQ })}
            href="/tests/topics"
          />
        </div>
      </section>
    </div>
  );
}
