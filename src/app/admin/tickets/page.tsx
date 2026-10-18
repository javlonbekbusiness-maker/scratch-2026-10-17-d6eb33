import Link from 'next/link';
import { db } from '@/lib/db';
import { deleteEmptyTicket, generateTickets, toggleTicketFree } from '../actions';
import { Badge, PageHeader, Stat, inputSm } from '../ui';
import { ConfirmButton } from '../ConfirmButton';

export const dynamic = 'force-dynamic';

function message(msg?: string): [string, 'ok' | 'warn' | 'err'] | null {
  if (!msg) return null;
  let m: RegExpMatchArray | null;
  if ((m = msg.match(/^free-(\d+)$/))) return [`Ticket ${m[1]} is now a free demo ticket.`, 'ok'];
  if ((m = msg.match(/^locked-(\d+)$/))) return [`Ticket ${m[1]} now requires a subscription.`, 'ok'];
  if ((m = msg.match(/^deleted-(\d+)$/))) return [`Empty ticket ${m[1]} removed.`, 'ok'];
  if ((m = msg.match(/^generated-(\d+)-(\d+)$/)))
    return [`Generated ${m[1]} tickets.${Number(m[2]) ? ` ${m[2]} questions didn't fill a whole ticket and stay unassigned (still used in topic, marathon and exam modes).` : ''}`, 'ok'];
  if ((m = msg.match(/^too-few-(\d+)-(\d+)$/))) return [`Not enough active questions: ${m[1]} available, ${m[2]} needed for one ticket. Existing tickets were kept.`, 'err'];
  if (msg === 'not-empty') return ['That ticket still has questions; move them first.', 'err'];
  if (msg === 'no-template') return ['Choose a ticket template.', 'err'];
  return null;
}
const TONE = { ok: 'bg-mint-500/10 text-mint-700', warn: 'bg-amber-100 text-amber-800', err: 'bg-red-500/10 text-red-700' };

export default async function TicketsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const categories = await db.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { tickets: true, questions: true } } } });
  const category = categories.find((c) => c.id === sp.category) ?? categories.find((c) => c._count.tickets > 0) ?? categories[0];
  if (!category) return <PageHeader title="Tickets" desc="Create a category first." />;

  const [tickets, perTicketTopic, unassigned, activeQuestions, templates, topics] = await Promise.all([
    db.ticket.findMany({ where: { categoryId: category.id }, orderBy: { number: 'asc' } }),
    db.question.groupBy({ by: ['ticketNumber', 'topicId'], where: { categoryId: category.id, ticketNumber: { not: null } }, _count: true }),
    db.question.count({ where: { categoryId: category.id, isActive: true, ticketNumber: null } }),
    db.question.count({ where: { categoryId: category.id, isActive: true } }),
    db.examTemplate.findMany({ where: { categoryId: category.id, kind: 'TICKET' }, orderBy: { createdAt: 'asc' } }),
    db.topic.findMany(),
  ]);
  const topicBy = new Map(topics.map((t) => [t.id, t]));
  const byTicket = new Map<number, { total: number; topics: { icon: string; name: string; count: number }[] }>();
  for (const row of perTicketTopic) {
    const entry = byTicket.get(row.ticketNumber!) ?? { total: 0, topics: [] };
    entry.total += row._count;
    const tp = row.topicId ? topicBy.get(row.topicId) : null;
    entry.topics.push({ icon: tp?.icon ?? '❔', name: tp?.nameUz ?? 'No topic', count: row._count });
    byTicket.set(row.ticketNumber!, entry);
  }
  const free = tickets.filter((t) => t.isFree).length;
  const msg = message(sp.msg);

  return (
    <>
      <PageHeader
        title="Tickets"
        desc="A ticket is the set of questions with the same ticket number. Free tickets are the demo available after phone verification."
      />
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${TONE[msg[1]]}`}>{msg[0]}</p>}

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Category">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/admin/tickets?category=${c.id}`}
            aria-current={c.id === category.id ? 'page' : undefined}
            className={`btn btn-sm ${c.id === category.id ? 'bg-brand-600 text-white' : 'btn-secondary'}`}
          >
            {c.code} <span className="opacity-70">({c._count.tickets})</span>
          </Link>
        ))}
      </nav>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tickets" value={tickets.length} />
        <Stat label="Free demo tickets" value={free} hint={free === 0 && tickets.length ? 'Free users have nothing to try!' : undefined} />
        <Stat label="Active questions" value={activeQuestions} />
        <Stat label="Not in any ticket" value={unassigned} />
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Ticket</th><th>Questions</th><th>Topics</th><th>Access</th><th></th></tr></thead>
          <tbody>
            {tickets.length === 0 && <tr><td colSpan={5} className="py-6 text-center muted">No tickets in {category.code}. Import questions with a ticket number, or generate tickets below.</td></tr>}
            {tickets.map((t) => {
              const info = byTicket.get(t.number);
              return (
                <tr key={t.id}>
                  <td className="text-lg font-extrabold">{t.number}</td>
                  <td className="tabular-nums">
                    <Link href={`/admin/questions?category=${category.id}&ticket=${t.number}`} className="hover:underline">{info?.total ?? 0}</Link>
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
                        <button className="btn-ghost btn-sm">{t.isFree ? 'Make paid' : 'Make free'}</button>
                      </form>
                      {!info?.total && (
                        <form action={deleteEmptyTicket}>
                          <input type="hidden" name="id" value={t.id} />
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

      <section className="card mt-6 p-5" aria-labelledby="gen-h">
        <h2 id="gen-h" className="font-bold">Generate tickets automatically</h2>
        <p className="mt-1 text-sm muted">
          Shuffles all active {category.code} questions into numbered tickets using a ticket template (size and topic mix). This <b>replaces the current ticket numbers</b>; which ticket numbers are free is kept.
        </p>
        {templates.length === 0 ? (
          <p className="mt-3 text-sm">No ticket template for {category.code}. <Link href="/admin/exam#new" className="text-brand-600 underline">Create one in Exam templates</Link> (kind “Ticket”).</p>
        ) : (
          <form action={generateTickets} className="mt-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="tpl">Ticket template</label>
            <select id="tpl" name="templateId" className={`${inputSm} w-auto`}>
              {templates.map((t) => {
                const mix = Object.entries((t.topicMix ?? {}) as Record<string, number>).map(([k, v]) => `${k}:${v}`).join(', ');
                return <option key={t.id} value={t.id}>{t.name} — {t.questionCount} per ticket{mix ? ` (${mix})` : ''}</option>;
              })}
            </select>
            <ConfirmButton message={`Regenerate all ${category.code} tickets? Current ticket numbers will be replaced.`} className="btn-primary btn-sm">
              Regenerate tickets
            </ConfirmButton>
          </form>
        )}
      </section>
    </>
  );
}
