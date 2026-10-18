import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { formatDate, formatUzs } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { promoStatus, statsByCode, toTashkentInput } from '@/lib/promo-stats';
import { promoAction } from '../../actions';
import { Badge, PageHeader, Stat } from '../../ui';
import { PromoForm } from '../PromoForm';

export const dynamic = 'force-dynamic';

export default async function EditPromo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [code, plans, partners, stats, payments] = await Promise.all([
    db.promoCode.findUnique({ where: { id } }),
    db.plan.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.partner.findMany({ orderBy: { name: 'asc' } }),
    statsByCode([id]),
    db.payment.findMany({ where: { promoCodeId: id }, include: { user: true, plan: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  if (!code) notFound();
  const st = stats.get(id);
  const status = promoStatus(code, st.uses);

  return (
    <>
      <PageHeader
        title={`Edit ${code.code}`}
        desc={code.batchId ? `Part of bulk batch ${code.batchId}` : `Created ${formatDate(code.createdAt)}`}
        actions={<Link href="/admin/promo" className="btn-ghost btn-sm">← All codes</Link>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Status" value={<Badge tone={status === 'active' ? 'green' : status === 'paused' ? 'slate' : 'amber'}>{status}</Badge>} />
        <Stat label="Redemptions" value={`${st.uses}${code.usageLimit != null ? ` / ${code.usageLimit}` : ''}`} />
        <Stat label="Paid / checkouts" value={`${st.paid} / ${st.checkouts}`} hint={st.checkouts ? `${Math.round((100 * st.paid) / st.checkouts)}% conversion` : undefined} />
        <Stat label="Revenue after discount" value={`${formatUzs(st.revenueUzs)} so'm`} hint={`${formatUzs(st.discountUzs)} so'm discount given`} />
      </div>

      <section className="card p-5">
        <PromoForm
          mode="edit"
          plans={plans.map((p) => ({ value: p.slug, label: p.labelUz }))}
          partners={partners.map((p) => ({ value: p.id, label: `${p.name} (${p.commissionPct}%)` }))}
          defaults={{
            id: code.id,
            code: code.code,
            type: code.type,
            value: String(code.value),
            startsAt: toTashkentInput(code.startsAt),
            endsAt: toTashkentInput(code.endsAt),
            usageLimit: code.usageLimit != null ? String(code.usageLimit) : '',
            perUserLimit: String(code.perUserLimit),
            minOrderUzs: code.minOrderUzs != null ? String(code.minOrderUzs) : '',
            planSlugs: code.planSlugs,
            newUsersOnly: code.newUsersOnly,
            combinable: code.combinable,
            partnerId: code.partnerId ?? '',
            note: code.note ?? '',
            isActive: code.isActive,
          }}
        />
      </section>

      <section className="mt-6" aria-labelledby="pays-h">
        <h2 id="pays-h" className="mb-3 text-lg font-bold">Recent checkouts with this code</h2>
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Date</th><th>User</th><th>Plan</th><th>Price</th><th>Discount</th><th>Paid</th><th>Status</th></tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={7} className="py-6 text-center muted">No checkouts yet.</td></tr>}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>{p.user.name ?? '—'} <span className="text-xs muted">{formatPhone(p.user.phone)}</span></td>
                  <td>{p.plan.labelUz}</td>
                  <td className="tabular-nums">{formatUzs(p.amountUzs)}</td>
                  <td className="tabular-nums">−{formatUzs(p.discountUzs)}</td>
                  <td className="tabular-nums font-semibold">{formatUzs(p.finalAmountUzs)}</td>
                  <td><Badge tone={p.status === 'PAID' ? 'green' : p.status === 'FAILED' ? 'red' : 'slate'}>{p.status.toLowerCase()}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <form action={promoAction} className="mt-8 border-t border-slate-200 pt-4 dark:border-slate-800">
        <input type="hidden" name="id" value={code.id} />
        <input type="hidden" name="op" value="delete" />
        <button className="btn-ghost btn-sm text-red-600">Delete code (paused instead if it has payments)</button>
      </form>
    </>
  );
}
