import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { progressBy } from '@/lib/progress';
import { TICKET_SIZE } from '@/lib/tickets';
import { startTestAction } from '@/app/actions';
import { ProgressCard } from '@/components/ui/Cards';
import { EmptyState } from '@/components/ui/Primitives';
import { Icon } from '@/components/ui/Icon';
import { Pager, pageParam } from '@/components/ui/Pager';

const TICKETS_PER_PAGE = 40;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('home.tickets'), robots: { index: false } };
}

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { t } = await getT();
  const [access, total] = await Promise.all([getAccess(user.id), db.ticket.count()]);
  const { page, pages, skip } = pageParam(sp.page, total, TICKETS_PER_PAGE);
  const tickets = await db.ticket.findMany({ orderBy: { number: 'asc' }, skip, take: TICKETS_PER_PAGE });
  const numbers = tickets.map((tk) => tk.number);
  const [counts, progress] = await Promise.all([
    db.question.groupBy({ by: ['ticketNumber'], where: { isActive: true, ticketNumber: { in: numbers } }, _count: true }),
    progressBy(user.id, 'ticketNumber'),
  ]);
  const qCount = new Map(counts.map((c) => [c.ticketNumber, c._count]));
  const href = (p: number) => (p > 1 ? `/tests/tickets?page=${p}` : '/tests/tickets');

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
      {total > 0 && <p className="text-small text-muted">{t('lists.ticketsSummary', { n: total, size: TICKET_SIZE })}</p>}

      {tickets.length === 0 ? (
        <div className="card"><EmptyState icon="ticket" title={t('modes.noQuestions')} /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {tickets.map((tk) => {
            const n = qCount.get(tk.number) ?? 0;
            const p = progress.get(String(tk.number));
            const locked = !tk.isFree && !access.active;
            const card = (
              <ProgressCard
                lead={tk.number}
                title={t('modes.ticketN', { n: tk.number })}
                subtitle={t('modes.qCount', { n })}
                progress={{ value: p?.mastered ?? 0, max: n }}
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

      <Pager page={page} pages={pages} href={href} labels={{ prev: t('common.prev'), next: t('common.next'), pageOf: t('lists.pageOf', { page, pages }), nav: t('lists.pager') }} />
    </div>
  );
}
