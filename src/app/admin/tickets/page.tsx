import { requireAdmin } from '@/lib/session';
import Link from 'next/link';
import { db } from '@/lib/db';
import { TICKET_SIZE } from '@/lib/tickets';
import { pageParam } from '@/components/ui/Pager';
import { assignTicketsAction, deleteEmptyTicket, toggleTicketFree } from '../actions';
import { Badge, PageHeader, Stat } from '../ui';

export const dynamic = 'force-dynamic';

const PER_PAGE = 50;

function message(msg?: string): [string, 'ok' | 'warn' | 'err'] | null {
  if (!msg) return null;
  let m: RegExpMatchArray | null;
  if ((m = msg.match(/^free-(\d+)$/))) return [`Ticket ${m[1]} is now a free demo ticket.`, 'ok'];
  if ((m = msg.match(/^locked-(\d+)$/))) return [`Ticket ${m[1]} now requires a subscription.`, 'ok'];
  if ((m = msg.match(/^deleted-(\d+)$/))) return [`Empty ticket ${m[1]} removed.`, 'ok'];
  if ((m = msg.match(/^assigned-(\d+)-(\d+)$/)))
    return [
      `${Number(m[1]) ? `Created ${m[1]} new tickets.` : 'No new tickets needed.'}${Number(m[2]) ? ` ${m[2]} new questions are waiting until there are ${TICKET_SIZE} for a whole ticket (they are already used in topic, marathon and exam modes).` : ''}`,
      'ok',
    ];
  if (msg === 'not-empty') return ['That ticket still has questions; move them first.', 'err'];
  return null;
}
const TONE = { ok: 'bg-mint-500/10 text-mint-700', warn: 'bg-amber-100 text-amber-800', err: 'bg-red-500/10 text-red-700' };

export default async function TicketsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [total, unassigned, activeQuestions, free, topics] = await Promise.all([
    db.ticket.count(),
    db.question.count({ where: { isActive: true, ticketNumber: null } }),
    db.question.count({ where: { isActive: true } }),
    db.ticket.count({ where: { isFree: true } }),
    db.topic.findMany(),
  ]);
  const { page, pages, skip } = pageParam(sp.page, total, PER_PAGE);
  const tickets = await db.ticket.findMany({ orderBy: { number: 'asc' }, skip, take: PER_PAGE });
  const perTicketTopic = await db.question.groupBy({ by: ['ticketNumber', 'topicId'], where: { ticketNumber: { in: tickets.map((t) => t.number) } }, _count: true });
  const topicBy = new Map(topics.map((t) => [t.id, t]));
  const byTicket = new Map<number, { total: number; topics: { icon: string; name: string; count: number }[] }>();
  for (const row of perTicketTopic) {
    const entry = byTicket.get(row.ticketNumber!) ?? { total: 0, topics: [] };
    entry.total += row._count;
    const tp = row.topicId ? topicBy.get(row.topicId) : null;
    entry.topics.push({ icon: tp?.icon ?? '❔', name: tp?.nameUz ?? 'No topic', count: row._count });
    byTicket.set(row.ticketNumber!, entry);
  }
  const msg = message(sp.msg);
  const pageField = page > 1 ? <input type="hidden" name="page" value={page} /> : null;

  return (
    <>
      <PageHeader
        title="Tickets"
        desc={`One shared question pool for all users. Tickets of ${TICKET_SIZE} questions are dealt automatically and never re-dealt: new questions go into new tickets. Free tickets are the demo available after phone verification.`}
      />
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${TONE[msg[1]]}`}>{msg[0]}</p>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tickets" value={total} />
        <Stat label="Free demo tickets" value={free} hint={free === 0 && total ? 'Free users have nothing to try!' : undefined} />
        <Stat label="Active questions" value={activeQuestions} />
        <Stat label="Not in any ticket yet" value={unassigned} />
      </div>

      <section className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-5" aria-labelledby="gen-h">
        <div>
          <h2 id="gen-h" className="font-bold">Put new questions into tickets</h2>
          <p className="mt-1 text-sm muted">
            Deals active questions without a ticket into new tickets numbered after the last one, in a fixed order. Existing tickets are not changed. This also runs after saving a new question and after a CSV import.
          </p>
        </div>
        <form action={assignTicketsAction}>
          <button className="btn-primary btn-sm" disabled={unassigned < TICKET_SIZE}>Create new tickets ({Math.floor(unassigned / TICKET_SIZE)})</button>
        </form>
      </section>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Ticket</th><th>Questions</th><th>Topics</th><th>Access</th><th></th></tr></thead>
          <tbody>
            {tickets.length === 0 && <tr><td colSpan={5} className="py-6 text-center muted">No tickets yet. Add at least {TICKET_SIZE} active questions.</td></tr>}
            {tickets.map((t) => {
              const info = byTicket.get(t.number);
              return (
                <tr key={t.id}>
                  <td className="text-lg font-extrabold">{t.number}</td>
                  <td className="tabular-nums">
                    <Link href={`/admin/questions?ticket=${t.number}`} className="hover:underline">{info?.total ?? 0}</Link>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {info?.topics.sort((a, b) => b.count - a.count).map((tp) => (
                        <span key={tp.name} className="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" title={tp.name}>{tp.icon} {tp.count}</span>
                      )) ?? <span className="muted">—</span>}
                    </div>
                  </td>
                  <td>{t.isFree ? <Badge tone="green">free demo</Badge> : <Badge>subscribers</Badge>}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-1">
                      <form action={toggleTicketFree}>
                        <input type="hidden" name="id" value={t.id} />
                        {pageField}
                        <button className="btn-ghost btn-sm">{t.isFree ? 'Make paid' : 'Make free'}</button>
                      </form>
                      {!info?.total && (
                        <form action={deleteEmptyTicket}>
                          <input type="hidden" name="id" value={t.id} />
                          {pageField}
                          <button className="btn-ghost btn-sm text-red-600">Remove</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? <Link className="btn-secondary btn-sm" href={`/admin/tickets?page=${page - 1}`}>← Previous</Link> : <span />}
          <span className="muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn-secondary btn-sm" href={`/admin/tickets?page=${page + 1}`}>Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
