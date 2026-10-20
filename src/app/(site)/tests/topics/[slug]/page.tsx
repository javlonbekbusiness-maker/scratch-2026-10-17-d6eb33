import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { progressBy } from '@/lib/progress';
import { QUICK_TOPIC_SIZE, freeTopicQuestions } from '@/lib/topics';
import { startTestAction } from '@/app/actions';
import { Paywall } from '@/components/Paywall';
import { IconTile, toTone } from '@/components/ui/Cards';
import { Icon, isIconName, type IconName } from '@/components/ui/Icon';
import { ButtonLink } from '@/components/ui/Primitives';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ empty?: string; locked?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, { locale }] = await Promise.all([params, getT()]);
  const topic = await db.topic.findUnique({ where: { slug } });
  return { title: topic ? pick(topic, 'name', locale) : 'Mavzu', robots: { index: false } };
}

export default async function TopicDetail({ params, searchParams }: Props) {
  const user = await requireUser();
  const [{ slug }, sp, { t, locale }] = await Promise.all([params, searchParams, getT()]);
  const topic = await db.topic.findUnique({ where: { slug }, include: { group: true } });
  if (!topic || !topic.isActive || topic.group?.isActive === false) notFound();

  const [total, progress, mistakes, access, free] = await Promise.all([
    db.question.count({ where: { topicId: topic.id, isActive: true } }),
    progressBy(user.id, 'topicId'),
    db.reviewItem.count({ where: { userId: user.id, question: { topicId: topic.id, isActive: true } } }),
    getAccess(user.id),
    freeTopicQuestions(),
  ]);
  if (total === 0) notFound();
  const p = progress.get(topic.id);
  const answered = Math.min(p?.answered ?? 0, total);
  const freeN = Math.min(free, total);
  const name = pick(topic, 'name', locale);
  const desc = pick(topic, 'desc', locale);

  const start = (variant: string, content: React.ReactNode, className: string, disabled = false) => (
    <form action={startTestAction}>
      <input type="hidden" name="mode" value="TOPIC" />
      <input type="hidden" name="topic" value={topic.slug} />
      <input type="hidden" name="variant" value={variant} />
      <button className={className} disabled={disabled} data-variant={variant}>{content}</button>
    </form>
  );
  const option = (icon: IconName, title: string, hint: string) => (
    <>
      <Icon name={icon} size={20} />
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span>{title}</span>
        <span className="text-small font-normal opacity-80">{hint}</span>
      </span>
    </>
  );

  return (
    <div className="page max-w-2xl space-y-4">
      {sp.locked && <Paywall closeHref={`/tests/topics/${topic.slug}`} />}
      <Link href="/tests/topics" className="inline-flex min-h-[48px] items-center gap-1 rounded-xl pr-3 text-small font-semibold text-muted hover:text-ink">
        <Icon name="chevronLeft" size={20} /> {t('topicsPage.title')}
      </Link>

      <header className="card p-5">
        <div className="flex items-start gap-4">
          <IconTile icon={isIconName(topic.icon) ? topic.icon : 'book'} tone={toTone(topic.group?.tone)} />
          <div className="min-w-0 flex-1">
            {topic.group && <p className="text-small font-semibold text-muted">{pick(topic.group, 'name', locale)}</p>}
            <h1 className="text-h1 [hyphens:auto] [overflow-wrap:anywhere]">{name}</h1>
          </div>
        </div>
        {desc && <p className="mt-3 text-ink">{desc}</p>}
        {topic.ruleRef && <p className="mt-2 text-small text-muted">{t('topicsPage.source', { ref: topic.ruleRef })}</p>}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label={t('topicsPage.questions')} value={String(total)} />
          <Stat label={t('topicsPage.solvedLabel')} value={`${answered}/${total}`} />
          <Stat label={t('topicsPage.yourAccuracy')} value={p?.accuracy === null || p?.accuracy === undefined ? '—' : `${p.accuracy}%`} />
        </dl>
      </header>

      {sp.empty && <p role="status" className="card-raised px-4 py-3 text-sm">{t('topicsPage.emptyMode')}</p>}

      <section className="space-y-2" aria-label={t('topicsPage.start')}>
        {access.active ? (
          <>
            {start('all', option('play', t('topicsPage.start'), t('topicsPage.startHint')), 'btn-primary w-full min-h-[64px] justify-start gap-3 px-4')}
            {start(
              'mistakes',
              option('mistakes', t('topicsPage.mistakes'), mistakes ? t('topicsPage.mistakesHint', { n: mistakes }) : t('topicsPage.noMistakes')),
              'btn-secondary w-full min-h-[64px] justify-start gap-3 px-4',
              mistakes === 0,
            )}
            {start('quick', option('timer', t('topicsPage.quick', { n: Math.min(QUICK_TOPIC_SIZE, total) }), t('topicsPage.quickHint', { n: Math.min(QUICK_TOPIC_SIZE, total) })), 'btn-secondary w-full min-h-[64px] justify-start gap-3 px-4')}
          </>
        ) : (
          <div className="card space-y-3 p-4">
            <p className="flex items-start gap-2 text-sm text-ink">
              <Icon name="lock" size={18} className="mt-0.5 text-muted" />
              {freeN > 0 ? t('topicsPage.freeNote', { n: freeN }) : t('topicsPage.subscriberOnly')}
            </p>
            {freeN > 0 && start('all', option('play', t('topicsPage.freeStart', { n: freeN }), t('topicsPage.free', { n: freeN })), 'btn-primary w-full min-h-[64px] justify-start gap-3 px-4')}
            <ButtonLink href="/pricing" variant={freeN > 0 ? 'secondary' : 'primary'} icon="sparkles" className="w-full">{t('topicsPage.unlockAll')}</ButtonLink>
          </div>
        )}
      </section>

      <Link href={topic.libraryHref || '/library'} className="card flex min-h-[64px] items-center gap-3 px-4 py-3 hover:border-brand-500/40">
        <Icon name="book" size={20} className="text-brand-fg" />
        <span className="flex-1 font-semibold">{t('topicsPage.library')}</span>
        <Icon name="chevronRight" size={20} className="text-muted" />
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-tile bg-raised px-2 py-3">
      <dt className="text-micro font-semibold uppercase text-muted">{label}</dt>
      <dd className="num mt-1 text-title text-ink">{value}</dd>
    </div>
  );
}
