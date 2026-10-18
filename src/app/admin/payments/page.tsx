import { requireAdmin } from '@/lib/session';
import Link from 'next/link';
import { db } from '@/lib/db';
import { formatDate, formatUzs } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { providerLabel } from '@/lib/payments';
import { paymentWhere, pickPaymentFilters } from '@/lib/admin-filters';
import { Badge, PageHeader, Stat, inputSm } from '../ui';

export const dynamic = 'force-dynamic';
const PAGE = 50;

const time = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(11, 16);

export default async function PaymentsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const filters = pickPaymentFilters(sp);
  const where = paymentWhere(filters);

  const [rows, total, byStatus] = await Promise.all([
    db.payment.findMany({ where, include: { user: true, plan: true, promoCode: true, campaign: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE, take: PAGE }),
    db.payment.count({ where }),
    db.payment.groupBy({ by: ['status'], where, _count: true, _sum: { finalAmountUzs: true, discountUzs: true } }),
  ]);
  const stat = (s: string) => byStatus.find((b) => b.status === s);
  const paid = stat('PAID');
  const failed = stat('FAILED')?._count ?? 0;
  const pending = stat('PENDING')?._count ?? 0;

  const filterQs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  const qs = (p: number) => `?${filterQs ? `${filterQs}&` : ''}page=${p}`;
  const hasFilters = !!filterQs;

  return (
    <>
      <PageHeader
        title="Payments"
        desc="Times are Tashkent time. Amounts in so'm; “Paid” is the amount charged after discounts."
        actions={<a href={`/api/admin/export/payments${filterQs ? `?${filterQs}` : ''}`} className="btn-secondary btn-sm">⬇ Export {hasFilters ? 'filtered' : 'all'} (CSV)</a>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={hasFilters ? 'Revenue (filtered)' : 'Revenue (all time)'} value={`${formatUzs(paid?._sum.finalAmountUzs ?? 0)} so'm`} hint={`${paid?._count ?? 0} paid`} />
        <Stat label="Discounts given" value={`${formatUzs(paid?._sum.discountUzs ?? 0)} so'm`} hint="on paid payments" />
        <Stat label="Success rate" value={total ? `${Math.round((100 * (paid?._count ?? 0)) / total)}%` : '—'} hint={`${failed} failed · ${pending} pending`} />
        <Stat label="Payments" value={total} />
      </div>

      <form className="card mb-3 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={filters.q} placeholder="Phone, name, payment ID or provider ref" className={inputSm} aria-label="Search payments" />
        <select name="status" defaultValue={filters.status ?? ''} className={inputSm} aria-label="Status">
          <option value="">All statuses</option>
          {['PAID', 'PENDING', 'FAILED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
        <select name="provider" defaultValue={filters.provider ?? ''} className={inputSm} aria-label="Provider">
          <option value="">All providers</option>
          {(['CLICK', 'PAYME', 'UZUM', 'FREE'] as const).map((p) => <option key={p} value={p}>{providerLabel[p]}</option>)}
        </select>
        <input name="promo" defaultValue={filters.promo} placeholder="Promo code" className={`${inputSm} uppercase`} aria-label="Promo code" />
        <input name="from" type="date" defaultValue={filters.from} className={inputSm} aria-label="From date" />
        <input name="to" type="date" defaultValue={filters.to} className={inputSm} aria-label="To date" />
        <div className="flex gap-2">
          <button className="btn-primary btn-sm">Filter</button>
          {hasFilters && <Link href="/admin/payments" className="btn-ghost btn-sm">Clear</Link>}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Date</th><th>User</th><th>Plan</th><th>Provider</th><th>Price</th><th>Discount</th><th>Paid</th><th>Applied</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="py-6 text-center muted">No payments match.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap">{formatDate(p.createdAt)} <span className="text-xs muted">{time(p.createdAt)}</span></td>
                <td>
                  <Link href={`/admin/users/${p.userId}`} className="font-medium hover:underline">{p.user.name || formatPhone(p.user.phone)}</Link>
                  <p className="text-xs muted">{formatPhone(p.user.phone)}</p>
                </td>
                <td>{p.plan.labelUz}{p.bonusDays ? <span className="text-xs text-mint-700"> +{p.bonusDays}d</span> : null}</td>
                <td>{providerLabel[p.provider]}{p.providerRef && <p className="max-w-[9rem] truncate font-mono text-[11px] muted" title={p.providerRef}>{p.providerRef}</p>}</td>
                <td className="tabular-nums">{formatUzs(p.amountUzs)}</td>
                <td className="tabular-nums">{p.discountUzs ? `−${formatUzs(p.discountUzs)}` : '—'}</td>
                <td className="font-semibold tabular-nums">{formatUzs(p.finalAmountUzs)}</td>
                <td className="text-xs">
                  {p.promoCode && <Link href={`/admin/promo/${p.promoCode.id}`} className="font-mono hover:underline">{p.promoCode.code}</Link>}
                  {p.campaign && <span className="block muted">{p.campaign.name}</span>}
                  {!p.promoCode && !p.campaign && <span className="muted">—</span>}
                </td>
                <td><Badge tone={p.status === 'PAID' ? 'green' : p.status === 'FAILED' ? 'red' : p.status === 'REFUNDED' ? 'amber' : 'slate'}>{p.status.toLowerCase()}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="muted">{total} payments · page {page} of {Math.max(1, Math.ceil(total / PAGE))}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={qs(page - 1)} className="btn-secondary btn-sm">← Prev</Link>}
          {page * PAGE < total && <Link href={qs(page + 1)} className="btn-secondary btn-sm">Next →</Link>}
        </div>
      </div>
    </>
  );
}
