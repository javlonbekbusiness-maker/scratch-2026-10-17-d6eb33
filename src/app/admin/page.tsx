import { requireAdmin } from '@/lib/session';
import Link from 'next/link';
import { db } from '@/lib/db';
import { formatUzs } from '@/lib/format';
import { PageHeader, Stat } from './ui';

export const dynamic = 'force-dynamic';

function Bars({ data, format }: { data: { day: string; v: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="flex h-32 items-end gap-[3px]" role="img" aria-label="30-day chart">
      {data.map((d) => (
        <div key={d.day} className="group relative flex-1">
          <div className="w-full rounded-t bg-brand-500/80 group-hover:bg-brand-600" style={{ height: `${Math.max(2, (d.v / max) * 120)}px` }} />
          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
            {d.day.slice(5)}: {format ? format(d.v) : d.v}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function AdminHome() {
  await requireAdmin();
  const since = new Date(Date.now() - 30 * 86400_000);
  const [users, signups30, payers, active, revenue30, missed, signupDays, revenueDays, topCodes] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.payment.groupBy({ by: ['userId'], where: { status: 'PAID' } }).then((r) => r.length),
    db.subscription.groupBy({ by: ['userId'], where: { expiresAt: { gt: new Date() } } }).then((r) => r.length),
    db.payment.aggregate({ where: { status: 'PAID', paidAt: { gte: since } }, _sum: { finalAmountUzs: true, discountUzs: true }, _count: true }),
    db.$queryRaw<{ questionId: string; total: bigint; wrong: bigint }[]>`
      SELECT "questionId", COUNT(*) AS total, COUNT(*) FILTER (WHERE NOT "isCorrect") AS wrong
      FROM "SessionAnswer" GROUP BY "questionId" HAVING COUNT(*) >= 3
      ORDER BY (COUNT(*) FILTER (WHERE NOT "isCorrect"))::float / COUNT(*) DESC LIMIT 10`,
    db.$queryRaw<{ day: string; v: bigint }[]>`
      SELECT to_char(date_trunc('day', "createdAt" + interval '5 hours'), 'YYYY-MM-DD') AS day, COUNT(*) AS v
      FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ day: string; v: bigint }[]>`
      SELECT to_char(date_trunc('day', "paidAt" + interval '5 hours'), 'YYYY-MM-DD') AS day, SUM("finalAmountUzs") AS v
      FROM "Payment" WHERE status = 'PAID' AND "paidAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ code: string; uses: bigint; revenue: bigint | null }[]>`
      SELECT c.code, COUNT(p.id) AS uses, SUM(p."finalAmountUzs") AS revenue
      FROM "PromoCode" c JOIN "Payment" p ON p."promoCodeId" = c.id AND p.status = 'PAID'
      GROUP BY c.code ORDER BY uses DESC LIMIT 5`,
  ]);

  const fill = (rows: { day: string; v: bigint }[]) => {
    const m = new Map(rows.map((r) => [r.day, Number(r.v)]));
    return Array.from({ length: 30 }, (_, i) => {
      const day = new Date(Date.now() + 5 * 3600_000 - (29 - i) * 86400_000).toISOString().slice(0, 10);
      return { day, v: m.get(day) ?? 0 };
    });
  };
  const questions = await db.question.findMany({ where: { id: { in: missed.map((m) => m.questionId) } }, select: { id: true, textUz: true, ticketNumber: true } });
  const qText = new Map(questions.map((q) => [q.id, q]));

  return (
    <>
      <PageHeader title="Analytics" desc="Last 30 days unless noted. Revenue is after discounts." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Users" value={users} hint={`+${signups30} in 30 days`} />
        <Stat label="Conversion" value={`${users ? ((100 * payers) / users).toFixed(1) : 0}%`} hint={`${payers} paying users (all time)`} />
        <Stat label="Revenue (30d)" value={`${formatUzs(revenue30._sum.finalAmountUzs ?? 0)} so'm`} hint={`${revenue30._count} payments · ${formatUzs(revenue30._sum.discountUzs ?? 0)} discounts`} />
        <Stat label="Active subscribers" value={active} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Signups per day</h2>
          <Bars data={fill(signupDays)} />
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Revenue per day</h2>
          <Bars data={fill(revenueDays)} format={(v) => `${formatUzs(v)} so'm`} />
        </section>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="card overflow-x-auto p-5">
          <h2 className="mb-3 font-bold">Most-missed questions</h2>
          {missed.length === 0 ? <p className="text-sm muted">Not enough answers yet.</p> : (
            <table className="tbl">
              <thead><tr><th>Question</th><th>Ticket</th><th>Answers</th><th>Wrong</th></tr></thead>
              <tbody>
                {missed.map((m) => {
                  const q = qText.get(m.questionId);
                  return (
                    <tr key={m.questionId}>
                      <td className="max-w-md"><Link href={`/admin/questions/${m.questionId}`} className="hover:underline">{q?.textUz.slice(0, 90)}</Link></td>
                      <td>{q?.ticketNumber ?? '—'}</td>
                      <td className="tabular-nums">{Number(m.total)}</td>
                      <td className="font-semibold tabular-nums text-red-600">{Math.round((100 * Number(m.wrong)) / Number(m.total))}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Top promo codes</h2>
          {topCodes.length === 0 ? <p className="text-sm muted">No redemptions yet.</p> : (
            <ul className="space-y-2 text-sm">
              {topCodes.map((c) => (
                <li key={c.code} className="flex justify-between">
                  <span className="font-mono font-semibold">{c.code}</span>
                  <span className="tabular-nums muted">{Number(c.uses)} · {formatUzs(Number(c.revenue ?? 0))}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/promo" className="mt-4 inline-block text-sm text-brand-600 hover:underline">Full report →</Link>
        </section>
      </div>
    </>
  );
}
