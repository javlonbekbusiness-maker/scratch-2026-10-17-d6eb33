import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { userStats } from '@/lib/stats';
import { dueCount } from '@/lib/srs';
import { getActiveOffer } from '@/lib/shell';
import { getTrickyQuestions } from '@/lib/tricky';
import { DAILY_GOAL, answersToday, getResumeSession, homeCounts } from '@/lib/home';
import { getDailyStatus } from '@/lib/daily-limit';
import { db } from '@/lib/db';
import { getT } from '@/i18n/server';
import { formatDate } from '@/lib/format';
import { startTestAction } from '@/app/actions';
import { HeroCard } from '@/components/ui/HeroCard';
import { PromoBanner } from '@/components/ui/PromoBanner';
import { ActionCard, WideCard } from '@/components/ui/Cards';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Primitives';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('nav.dashboard'), robots: { index: false } };
}

export default async function Dashboard() {
  const user = await requireUser();
  const { t } = await getT();
  const [stats, access, due, offer, resume, today, counts, daily, tricky] = await Promise.all([
    userStats(user.id),
    getAccess(user.id),
    dueCount(user.id),
    getActiveOffer(user),
    getResumeSession(user),
    answersToday(user.id),
    homeCounts(user),
    getDailyStatus(db, user.id),
    getTrickyQuestions(),
  ]);
  const modeLabel = (m: string, n: number | null) => (m === 'TICKET' ? t('modes.ticketN', { n: n ?? '' }) : t(`modes.${m.toLowerCase()}` as 'modes.exam'));
  const heroBtn = 'btn w-full bg-white text-brand-700 shadow-lg shadow-black/10 hover:bg-white/90';

  const heroAction = resume ? (
    <Link href={`/test/${resume.id}`} className={heroBtn}>
      <Icon name="play" size={20} /> {t('home.continue')}
    </Link>
  ) : (
    <form action={startTestAction}>
      <input type="hidden" name="mode" value="ADAPTIVE" />
      <button className={heroBtn}><Icon name="sparkles" size={20} /> {t('home.continue')}</button>
    </form>
  );
  const heroHint = resume
    ? t('home.resumeHint', { name: modeLabel(resume.mode, resume.ticketNumber), done: resume.answered, total: resume.total })
    : t('home.smartHint');

  // Exam card: paywall for free users, limit message when today's full tests are used up.
  const examCard = !access.active ? (
    <ActionCard icon="timer" tone="violet" title={t('home.exam')} subtitle={t('home.examSub', { n: 20 })} href="/tests?locked=1" />
  ) : daily.remaining === 0 ? (
    <ActionCard icon="timer" tone="violet" title={t('home.exam')} subtitle={t('home.examLimit')} href="/tests?limit=1" />
  ) : (
    <form action={startTestAction} className="h-full">
      <input type="hidden" name="mode" value="EXAM" />
      <ActionCard icon="timer" tone="violet" title={t('home.exam')} subtitle={t('limit.remaining', { n: daily.remaining, max: daily.limit })} submit />
    </form>
  );
  const mistakesCard = counts.reviewTotal ? (
    <form action={startTestAction} className="h-full">
      <input type="hidden" name="mode" value="MISTAKES" />
      <ActionCard icon="mistakes" tone="danger" title={t('home.mistakes')} subtitle={due ? t('home.mistakesDue', { n: due }) : t('home.mistakesLater')} badge={due} submit />
    </form>
  ) : (
    <ActionCard icon="mistakes" tone="danger" title={t('home.mistakes')} subtitle={t('modes.noMistakes')} href="/stats" />
  );

  return (
    <div className="page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-h1">{t('dashboard.greeting', { name: user.name ?? '' })}</h1>
        {access.active ? (
          <Badge tone="success"><Icon name="check" size={14} /> {t('dashboard.subscriptionActive', { date: formatDate(access.expiresAt!) })}</Badge>
        ) : (
          <Link href="/pricing" className="chip min-h-[40px] bg-brand-600 px-4 text-sm text-white hover:bg-brand-700">{t('dashboard.upgrade')}</Link>
        )}
      </div>

      <HeroCard
        readiness={stats.readiness}
        title={t('dashboard.readiness')}
        hint={t('dashboard.readinessHint')}
        action={heroAction}
        actionHint={heroHint}
        goal={{
          label: t('home.dailyGoal'),
          value: Math.min(today, DAILY_GOAL),
          max: DAILY_GOAL,
          text: today >= DAILY_GOAL ? t('home.goalDone') : t('home.goalValue', { n: today, goal: DAILY_GOAL }),
          done: today >= DAILY_GOAL,
        }}
      />

      {offer && (
        <PromoBanner
          title={t('home.promoTitle', { p: offer.pct })}
          text={offer.kind === 'welcome' ? t('home.promoWelcome') : t('home.promoSeasonal')}
          cta={t('home.promoCta')}
          endsLabel={t('home.promoEnds')}
          endsAt={offer.endsAt.toISOString()}
        />
      )}

      <section aria-label={t('home.practice')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <ActionCard icon="ticket" title={t('home.tickets')} subtitle={t('home.ticketsSub', { n: counts.tickets })} href="/tests/tickets" />
          <ActionCard icon="layers" tone="accent" title={t('home.topics')} subtitle={t('home.topicsSub', { n: counts.topics })} href="/tests/topics" />
          <ActionCard
            icon="trap"
            tone="warning"
            title={t('home.tricky')}
            subtitle={tricky.ids.length ? t('home.trickySub', { n: tricky.ids.length }) : t('home.trickyNone')}
            href="/tests/tricky"
          />
          {examCard}
          <ActionCard icon="signpost" title={t('home.rules')} subtitle={t('home.rulesSub')} href="/library" />
          {mistakesCard}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 sm:gap-4" aria-label={t('home.more')}>
        <WideCard icon="trophy" tone="warning" title={t('home.leaderboard')} subtitle={t('home.leaderboardSub')} href="/leaderboard" />
        <WideCard icon="duel" tone="violet" title={t('home.duel')} subtitle={t('home.duelSub')} soon={t('shell.soon')} />
      </section>
    </div>
  );
}
