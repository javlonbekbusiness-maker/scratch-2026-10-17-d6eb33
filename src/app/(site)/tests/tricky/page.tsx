import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { getTrickyQuestions, TRICKY_MIN_ANSWERS, TRICKY_MIN_WRONG_RATE } from '@/lib/tricky';
import { startTestAction } from '@/app/actions';
import { IconTile } from '@/components/ui/Cards';
import { ButtonLink, EmptyState, SectionHeader } from '@/components/ui/Primitives';
import { Icon } from '@/components/ui/Icon';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('home.tricky'), robots: { index: false } };
}

export default async function TrickyPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const [access, tricky] = await Promise.all([getAccess(user.id), getTrickyQuestions(user.categoryId!)]);
  const preview = await db.question.findMany({ where: { id: { in: tricky.ids.slice(0, 8) } }, select: { id: true, textUz: true, textRu: true, isTricky: true } });
  const order = new Map(tricky.ids.map((id, i) => [id, i]));
  preview.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return (
    <div className="page max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="grid h-12 w-12 place-items-center rounded-2xl text-muted hover:bg-raised" aria-label={t('common.back')}>
          <Icon name="chevronLeft" />
        </Link>
        <h1 className="text-h1">{t('home.tricky')}</h1>
      </div>

      <section className="card p-5">
        <div className="flex items-start gap-4">
          <IconTile icon="trap" tone="warning" />
          <div>
            <p className="text-title">{t('tricky.intro')}</p>
            <p className="mt-1 text-small text-muted">{t('tricky.how', { n: TRICKY_MIN_ANSWERS, p: Math.round(TRICKY_MIN_WRONG_RATE * 100) })}</p>
          </div>
        </div>
        {tricky.ids.length > 0 && (
          <div className="mt-5">
            {access.active ? (
              <form action={startTestAction}>
                <input type="hidden" name="mode" value="TRICKY" />
                <button className="btn-primary w-full sm:w-auto"><Icon name="play" size={20} /> {t('tricky.start', { n: Math.min(20, tricky.ids.length) })}</button>
              </form>
            ) : (
              <ButtonLink href="/tests?locked=1" icon="lock" className="w-full sm:w-auto">{t('tricky.start', { n: Math.min(20, tricky.ids.length) })}</ButtonLink>
            )}
          </div>
        )}
      </section>

      <section className="card p-5" aria-labelledby="tq-h">
        <SectionHeader id="tq-h" title={t('tricky.listTitle', { n: tricky.ids.length })} />
        {tricky.ids.length === 0 ? (
          <EmptyState icon="trap" title={t('home.trickyNone')} text={t('tricky.empty')} action={<ButtonLink href="/tests/tickets" variant="secondary" icon="ticket">{t('home.tickets')}</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-line">
            {preview.map((q) => (
              <li key={q.id} className="flex items-start gap-3 py-3">
                <p className="flex-1">{pick(q, 'text', locale)}</p>
                {tricky.missRate.has(q.id) && <span className="num chip shrink-0 bg-danger/10 text-danger">{t('tricky.missed', { p: tricky.missRate.get(q.id)! })}</span>}
                {q.isTricky && !tricky.missRate.has(q.id) && <span className="chip shrink-0 bg-warning/15 text-warning">{t('tricky.flagged')}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
