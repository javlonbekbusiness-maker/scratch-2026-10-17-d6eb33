import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { progressBy } from '@/lib/progress';
import { startTestAction } from '@/app/actions';
import { ProgressCard } from '@/components/ui/Cards';
import { EmptyState } from '@/components/ui/Primitives';
import { Icon } from '@/components/ui/Icon';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('home.tickets'), robots: { index: false } };
}

export default async function TicketsPage() {
  const user = await requireUser();
  const { t } = await getT();
  const categoryId = user.categoryId!;
  const [access, tickets, counts, progress] = await Promise.all([
    getAccess(user.id),
    db.ticket.findMany({ where: { categoryId }, orderBy: { number: 'asc' } }),
    db.question.groupBy({ by: ['ticketNumber'], where: { categoryId, isActive: true, ticketNumber: { not: null } }, _count: true }),
    progressBy(user.id, categoryId, 'ticketNumber'),
  ]);
  const qCount = new Map(counts.map((c) => [c.ticketNumber, c._count]));

  return (
    <div className="page space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="grid h-12 w-12 place-items-center rounded-2xl text-muted hover:bg-raised" aria-label={t('common.back')}>
          <Icon name="chevronLeft" />
        </Link>
        <div>
          <h1 className="text-h1">{t('home.tickets')}</h1>
          <p className="text-small text-muted">{t('modes.ticketDesc')}</p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="card"><EmptyState icon="ticket" title={t('modes.noQuestions')} /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {tickets.map((tk) => {
            const total = qCount.get(tk.number) ?? 0;
            const p = progress.get(String(tk.number));
            const locked = !tk.isFree && !access.active;
            const card = (
              <ProgressCard
                lead={tk.number}
                title={t('modes.ticketN', { n: tk.number })}
                subtitle={t('modes.qCount', { n: total })}
                progress={{ value: p?.mastered ?? 0, max: total }}
                progressLabel={t('lists.mastered')}
                accuracy={p?.accuracy ?? null}
                accuracyLabel={t('dashboard.accuracy')}
                badge={tk.isFree && !access.active ? t('modes.demo') : undefined}
                locked={locked}
                lockedLabel={t('common.locked')}
                {...(locked ? { href: '/tests?locked=1' } : { submit: true as const })}
              />
            );
            return locked ? (
              <div key={tk.id}>{card}</div>
            ) : (
              <form key={tk.id} action={startTestAction} className="h-full">
                <input type="hidden" name="mode" value="TICKET" />
                <input type="hidden" name="ticket" value={tk.number} />
                {card}
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}
