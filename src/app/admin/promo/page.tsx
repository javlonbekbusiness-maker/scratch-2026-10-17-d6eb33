import { requireAdmin } from '@/lib/session';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { formatDate, formatUzs } from '@/lib/format';
import { promoValueLabel } from '@/lib/promo';
import { promoStatus, statsByCode, sumStats, type PromoStatus } from '@/lib/promo-stats';
import { deletePartner, promoAction, savePartner } from '../actions';
import { Badge, PageHeader, Stat, inputSm } from '../ui';
import { PromoForm } from './PromoForm';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<PromoStatus, 'green' | 'slate' | 'blue' | 'red' | 'amber'> = {
  active: 'green', paused: 'slate', scheduled: 'blue', expired: 'red', 'used-up': 'amber',
};

const MESSAGES: Record<string, string> = {
  created: 'Promo code created.',
  updated: 'Promo code saved.',
  paused: 'Code paused.',
  resumed: 'Code resumed.',
  deleted: 'Code deleted.',
  kept: 'This code has payments or redemptions, so it was paused instead of deleted (records keep their link).',
  'partner-added': 'Partner added.',
  'partner-deleted': 'Partner deleted; their codes are kept without a partner.',
  'partner-name': 'Partner name is required (max 80 characters).',
  'partner-pct': 'Commission must be between 0 and 100%.',
};

const PAGE = 50;
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—');

export default async function PromoAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const where: Prisma.PromoCodeWhereInput = {
    ...(sp.batch ? { batchId: sp.batch } : { batchId: null }),
    ...(sp.q ? { OR: [{ code: { contains: sp.q.toUpperCase() } }, { note: { contains: sp.q, mode: 'insensitive' } }] } : {}),
    ...(sp.partner ? { partnerId: sp.partner } : {}),
  };

  const [codes, total, plans, partners, batches, allStats] = await Promise.all([
    db.promoCode.findMany({ where, include: { partner: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE, take: PAGE }),
    db.promoCode.count({ where }),
    db.plan.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.partner.findMany({ include: { codes: { select: { id: true } } }, orderBy: { createdAt: 'desc' } }),
    db.promoCode.groupBy({ by: ['batchId'], where: { batchId: { not: null } }, _count: true, _min: { createdAt: true, code: true } }),
    statsByCode(),
  ]);

  const batchCodes = batches.length
    ? await db.promoCode.findMany({ where: { batchId: { in: batches.map((b) => b.batchId!) } }, select: { id: true, batchId: true, type: true, value: true, partner: { select: { name: true } } } })
    : [];
  const totals = sumStats([...allStats.all.values()]);
  const planOpts = plans.map((p) => ({ value: p.slug, label: p.labelUz }));
  const partnerOpts = partners.map((p) => ({ value: p.id, label: `${p.name} (${p.commissionPct}%)` }));
  const kept = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== 'msg') as [string, string][]).toString();
  const back = kept ? `/admin/promo?${kept}` : '/admin/promo';
  const qs = (p: number) => `?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== 'msg')) as Record<string, string>), page: String(p) })}`;
  const activeBatch = sp.batch ? batches.find((b) => b.batchId === sp.batch) : null;

  return (
    <>
      <PageHeader
        title="Promo codes"
        desc="Codes are redeemed only after a successful payment; a failed or abandoned checkout releases them."
        actions={<>
          <a href="/api/admin/export/promo" className="btn-secondary btn-sm">⬇ Export all (CSV)</a>
          <a href="#new" className="btn-primary btn-sm">+ New code</a>
        </>}
      />

      {sp.msg && MESSAGES[sp.msg] && (
        <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${sp.msg.startsWith('partner-n') || sp.msg === 'partner-pct' ? 'bg-red-500/10 text-red-700' : sp.msg === 'kept' ? 'bg-amber-100 text-amber-800' : 'bg-mint-500/10 text-mint-700'}`}>
          {MESSAGES[sp.msg]}
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Redemptions" value={totals.uses} hint="Paid checkouts + free trials" />
        <Stat label="Revenue after discounts" value={`${formatUzs(totals.revenueUzs)} so'm`} hint={`${totals.paid} paid payments with a code`} />
        <Stat label="Discount given" value={`${formatUzs(totals.discountUzs)} so'm`} />
        <Stat label="Checkout conversion" value={pct(totals.paid, totals.checkouts)} hint={`${totals.checkouts} checkouts started with a code`} />
      </div>

      {sp.batch && (
        <section className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-bold">Batch <span className="font-mono">{sp.batch}</span>{activeBatch && <> · {activeBatch._count} codes</>}</p>
            {sp.n && <p className="text-sm text-mint-700">Generated {sp.n} unique codes.</p>}
          </div>
          <div className="flex gap-2">
            <a href={`/api/admin/export/promo?batch=${sp.batch}`} className="btn-primary btn-sm">⬇ Download batch CSV</a>
            <Link href="/admin/promo" className="btn-ghost btn-sm">Show individual codes</Link>
          </div>
        </section>
      )}

      <form className="card mb-3 grid gap-2 p-3 sm:grid-cols-[2fr_1fr_auto]">
        {sp.batch && <input type="hidden" name="batch" value={sp.batch} />}
        <input name="q" defaultValue={sp.q} placeholder="Search code or note" className={inputSm} aria-label="Search" />
        <select name="partner" defaultValue={sp.partner ?? ''} className={inputSm} aria-label="Partner">
          <option value="">All partners</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn-primary btn-sm">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr><th>Code</th><th>Discount</th><th>Rules</th><th>Uses</th><th>Paid / checkouts</th><th>Revenue</th><th>Partner</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {codes.length === 0 && <tr><td colSpan={9} className="py-6 text-center muted">No codes match.</td></tr>}
            {codes.map((c) => {
              const st = allStats.get(c.id);
              const status = promoStatus(c, st.uses);
              const rules = [
                c.startsAt && `from ${formatDate(c.startsAt)}`,
                c.endsAt && `until ${formatDate(c.endsAt)}`,
                c.minOrderUzs && `min ${formatUzs(c.minOrderUzs)}`,
                c.planSlugs.length && `plans: ${c.planSlugs.join(', ')}`,
                c.newUsersOnly && 'new users',
                c.combinable && 'combinable',
                c.perUserLimit > 1 && `${c.perUserLimit}/user`,
              ].filter(Boolean);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/promo/${c.id}`} className="font-mono font-bold hover:underline">{c.code}</Link>
                    {c.note && <p className="max-w-[16rem] truncate text-xs muted">{c.note}</p>}
                  </td>
                  <td className="whitespace-nowrap">{promoValueLabel(c, "so'm", 'days')}{c.type === 'FREE_TRIAL' && <span className="text-xs muted"> trial</span>}</td>
                  <td className="max-w-[14rem] text-xs muted">{rules.join(' · ') || '—'}</td>
                  <td className="tabular-nums">{st.uses}{c.usageLimit != null && <span className="muted"> / {c.usageLimit}</span>}</td>
                  <td className="tabular-nums">{st.paid} / {st.checkouts} <span className="text-xs muted">({pct(st.paid, st.checkouts)})</span></td>
                  <td className="whitespace-nowrap tabular-nums">{formatUzs(st.revenueUzs)}</td>
                  <td>{c.partner?.name ?? '—'}</td>
                  <td><Badge tone={STATUS_TONE[status]}>{status}</Badge></td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-1">
                      <Link href={`/admin/promo/${c.id}`} className="btn-ghost btn-sm">Edit</Link>
                      <form action={promoAction}>
                        <input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="toggle" /><input type="hidden" name="back" value={back} />
                        <button className="btn-ghost btn-sm">{c.isActive ? 'Pause' : 'Resume'}</button>
                      </form>
                      <form action={promoAction}>
                        <input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="delete" /><input type="hidden" name="back" value={back} />
                        <button className="btn-ghost btn-sm text-red-600" aria-label={`Delete ${c.code}`}>Delete</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="muted">{total} codes · page {page} of {Math.max(1, Math.ceil(total / PAGE))}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={qs(page - 1)} className="btn-secondary btn-sm">← Prev</Link>}
          {page * PAGE < total && <Link href={qs(page + 1)} className="btn-secondary btn-sm">Next →</Link>}
        </div>
      </div>

      {batches.length > 0 && (
        <section className="mt-8" aria-labelledby="batches-h">
          <h2 id="batches-h" className="mb-3 text-lg font-bold">Bulk batches</h2>
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Batch</th><th>Created</th><th>Codes</th><th>Discount</th><th>Partner</th><th>Redeemed</th><th>Revenue</th><th></th></tr></thead>
              <tbody>
                {batches.sort((a, b) => +b._min.createdAt! - +a._min.createdAt!).map((bt) => {
                  const members = batchCodes.filter((c) => c.batchId === bt.batchId);
                  const s = sumStats(members.map((m) => allStats.get(m.id)));
                  const sample = members[0];
                  return (
                    <tr key={bt.batchId}>
                      <td className="font-mono text-xs">{bt.batchId}</td>
                      <td>{formatDate(bt._min.createdAt!)}</td>
                      <td className="tabular-nums">{bt._count}</td>
                      <td>{sample ? promoValueLabel(sample, "so'm", 'days') : '—'}</td>
                      <td>{sample?.partner?.name ?? '—'}</td>
                      <td className="tabular-nums">{s.uses} <span className="text-xs muted">({pct(s.uses, bt._count)})</span></td>
                      <td className="tabular-nums">{formatUzs(s.revenueUzs)}</td>
                      <td className="whitespace-nowrap">
                        <Link href={`/admin/promo?batch=${bt.batchId}`} className="btn-ghost btn-sm">View</Link>
                        <a href={`/api/admin/export/promo?batch=${bt.batchId}`} className="btn-ghost btn-sm">CSV</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section id="partners" className="mt-8 scroll-mt-6" aria-labelledby="partners-h">
        <h2 id="partners-h" className="mb-1 text-lg font-bold">Partners &amp; influencers</h2>
        <p className="mb-3 text-sm muted">Link codes to a partner to track their checkouts, purchases and revenue. Commission is calculated on revenue after discounts.</p>
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Partner</th><th>Codes</th><th>Users (checkout)</th><th>Purchases</th><th>Revenue</th><th>Commission</th><th></th></tr></thead>
            <tbody>
              {partners.length === 0 && <tr><td colSpan={7} className="py-6 text-center muted">No partners yet.</td></tr>}
              {partners
                .map((p) => ({ p, s: sumStats(p.codes.map((c) => allStats.get(c.id))) }))
                .sort((a, b) => b.s.revenueUzs - a.s.revenueUzs)
                .map(({ p, s }) => (
                  <tr key={p.id}>
                    <td><span className="font-semibold">{p.name}</span>{p.contact && <p className="text-xs muted">{p.contact}</p>}</td>
                    <td><Link href={`/admin/promo?partner=${p.id}`} className="hover:underline">{p.codes.length}</Link></td>
                    <td className="tabular-nums">{s.buyers}</td>
                    <td className="tabular-nums">{s.paid}</td>
                    <td className="tabular-nums">{formatUzs(s.revenueUzs)}</td>
                    <td className="tabular-nums">{formatUzs(Math.round((s.revenueUzs * p.commissionPct) / 100))} <span className="text-xs muted">({p.commissionPct}%)</span></td>
                    <td>
                      <form action={deletePartner}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn-ghost btn-sm text-red-600" aria-label={`Delete partner ${p.name}`}>Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <form action={savePartner} className="card mt-3 grid gap-2 p-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
          <input name="name" required maxLength={80} placeholder="Partner name (e.g. Avtomaktab №1)" className={inputSm} aria-label="Partner name" />
          <input name="contact" maxLength={120} placeholder="Contact (optional)" className={inputSm} aria-label="Contact" />
          <input name="commissionPct" type="number" min={0} max={100} placeholder="Commission %" className={inputSm} aria-label="Commission percent" />
          <button className="btn-secondary btn-sm">Add partner</button>
        </form>
      </section>

      <section id="new" className="mt-8 grid scroll-mt-6 gap-6 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold">New promo code</h2>
          <PromoForm mode="create" plans={planOpts} partners={partnerOpts} />
        </div>
        <div className={`card p-5 ${sp.preset === 'school' ? 'ring-2 ring-brand-500' : ''}`}>
          <h2 className="mb-1 text-lg font-bold">Bulk generate</h2>
          <p className="mb-4 text-sm muted">For driving schools and partners: unique single-use codes, downloadable as CSV.</p>
          {sp.preset === 'school' && (
            <p className="mb-4 rounded-xl bg-brand-500/10 px-3 py-2 text-sm text-brand-700 dark:text-brand-300">
              Driving-school preset: 15% off, single-use codes. Pick the school as partner (add it below if needed) and adjust the count.
            </p>
          )}
          <PromoForm
            mode="bulk"
            plans={planOpts}
            partners={partnerOpts}
            defaults={sp.preset === 'school' ? { type: 'PERCENT', value: '15', prefix: 'SCHOOL-', count: '100', newUsersOnly: true, note: 'Driving school group' } : {}}
          />
        </div>
      </section>
    </>
  );
}
