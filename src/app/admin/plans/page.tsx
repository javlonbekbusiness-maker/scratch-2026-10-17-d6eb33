import { db } from '@/lib/db';
import { formatUzs } from '@/lib/format';
import { savingVsWeekly } from '@/lib/pricing';
import { savePlan } from '../actions';
import { Badge, PageHeader } from '../ui';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, [string, boolean]> = {
  saved: ['Plan saved. The pricing page shows the new values now.', true],
  'bad-price': ['Price must be a whole number from 1 000 to 10 000 000 so\'m.', false],
  'bad-duration': ['Duration must be 1–3650 days.', false],
  'bad-label': ['Uzbek and Russian names are required (max 40 characters).', false],
  'bad-order': ['Order must be a whole number.', false],
  'last-plan': ['At least one plan must stay active.', false],
};

const inp = 'input min-h-[40px] rounded-xl px-3 text-sm';

export default async function PlansAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const now = new Date();
  const [plans, active, sold] = await Promise.all([
    db.plan.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.subscription.groupBy({ by: ['planId'], where: { expiresAt: { gt: now }, planId: { not: null } }, _count: true }),
    db.payment.groupBy({ by: ['planId'], where: { status: 'PAID' }, _count: true, _sum: { finalAmountUzs: true } }),
  ]);
  const weekly = plans.find((p) => p.durationDays === 7 && !p.untilPass);
  const msg = sp.msg ? MESSAGES[sp.msg] : undefined;

  return (
    <>
      <PageHeader
        title="Plans"
        desc="Prices are in so'm. Changes apply to new checkouts immediately; existing subscriptions are not affected. “Save X%” is calculated against the 1-week plan."
      />
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${msg[1] ? 'bg-mint-500/10 text-mint-700' : 'bg-red-500/10 text-red-700'}`}>{msg[0]}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {plans.map((p) => {
          const a = active.find((x) => x.planId === p.id)?._count ?? 0;
          const s = sold.find((x) => x.planId === p.id);
          const saving = savingVsWeekly(p, weekly);
          const highlighted = sp.plan === p.id && sp.msg && sp.msg !== 'saved';
          return (
            <section key={p.id} className={`card p-5 ${highlighted ? 'ring-2 ring-red-400' : ''}`} aria-labelledby={`plan-${p.id}`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 id={`plan-${p.id}`} className="text-lg font-bold">
                  {p.labelUz} <span className="font-mono text-xs muted">{p.slug}</span>
                </h2>
                <div className="flex gap-1">
                  {p.isFeatured && <Badge tone="blue">⭐ best value</Badge>}
                  {p.untilPass && <Badge tone="amber">until pass</Badge>}
                  {p.isActive ? <Badge tone="green">on sale</Badge> : <Badge>hidden</Badge>}
                </div>
              </div>
              <p className="mb-4 text-sm muted">
                {formatUzs(p.priceUzs)} so&apos;m · {p.durationDays} days · {formatUzs(Math.round(p.priceUzs / p.durationDays))} so&apos;m/day
                {saving > 0 && ` · saves ${saving}% vs weekly`} · {a} active subscribers · {s?._count ?? 0} sold ({formatUzs(s?._sum.finalAmountUzs ?? 0)} so&apos;m)
              </p>
              <form action={savePlan} className="space-y-3">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="labelUzPrev" value={p.labelUz} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="label">Price (so&apos;m)</span>
                    <input name="priceUzs" type="number" min={1000} max={10000000} step={100} required defaultValue={p.priceUzs} className={inp} />
                  </label>
                  <label className="block">
                    <span className="label">Duration (days)</span>
                    <input name="durationDays" type="number" min={1} max={3650} required defaultValue={p.durationDays} className={inp} />
                  </label>
                  <label className="block">
                    <span className="label">Order</span>
                    <input name="sortOrder" type="number" defaultValue={p.sortOrder} className={inp} />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block"><span className="label">Name — O&apos;zbek</span><input name="labelUz" required maxLength={40} defaultValue={p.labelUz} className={inp} /></label>
                  <label className="block"><span className="label">Name — Кирилл</span><input name="labelCy" maxLength={40} defaultValue={p.labelCy} placeholder="auto from Uzbek" className={inp} /></label>
                  <label className="block"><span className="label">Name — Русский</span><input name="labelRu" required maxLength={40} defaultValue={p.labelRu} className={inp} /></label>
                </div>
                {p.untilPass && <p className="text-xs muted">“Until you pass”: access lasts this many days at most and ends early when the user taps “I passed”.</p>}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={p.isActive} className="h-4 w-4" /> On sale</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="isFeatured" defaultChecked={p.isFeatured} className="h-4 w-4" /> “Best value” badge (only one plan)</label>
                  <button className="btn-primary btn-sm ml-auto">Save plan</button>
                </div>
              </form>
            </section>
          );
        })}
      </div>
    </>
  );
}
