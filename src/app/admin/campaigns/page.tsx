import { requireAdmin } from '@/lib/session';
import Link from 'next/link';
import type { Campaign } from '@prisma/client';
import { db } from '@/lib/db';
import { formatDate, formatUzs } from '@/lib/format';
import { toTashkentInput } from '@/lib/promo-stats';
import { applyCampaignPreset, campaignAction } from '../actions';
import { Badge, PageHeader, Stat } from '../ui';
import { CampaignForm } from './CampaignForm';

export const dynamic = 'force-dynamic';

const PRESETS = [
  { id: 'welcome', icon: '🎁', name: 'Welcome offer', desc: '−20% for 24 h after phone verification, countdown banner' },
  { id: 'navruz', icon: '🌷', name: 'Navruz sale', desc: '−25%, 19–24 March, site banner' },
  { id: 'independence', icon: '🎆', name: 'Independence Day', desc: '−30%, 29 Aug – 3 Sep, site banner' },
  { id: 'blackfriday', icon: '🛍️', name: 'Black Friday', desc: '−40% for 4 days from the last Friday of November' },
  { id: 'school', icon: '🏫', name: 'Driving school partner', desc: 'Opens the bulk code generator: 15% single-use codes' },
  { id: 'referral', icon: '🤝', name: 'Referral reward', desc: "Friend gets −10% on their first purchase" },
  { id: 'winback', icon: '💌', name: 'Win-back', desc: '−20% single-use codes sent to lapsed users' },
];

const TYPE_LABEL: Record<string, string> = { SEASONAL: 'Seasonal', WELCOME: 'Welcome', REFERRAL: 'Referral', WINBACK: 'Win-back', PARTNER: 'Partner (legacy)' };
const TEMPLATE_FOR: Partial<Record<string, string>> = { WELCOME: 'WELCOME', WINBACK: 'WINBACK', REFERRAL: 'REFERRAL' };

const MESSAGES: Record<string, string> = {
  preset: 'Preset created as a draft (inactive). Adjust the values below and tick “Active”.',
  created: 'Campaign created.',
  updated: 'Campaign saved.',
  activated: 'Campaign activated.',
  paused: 'Campaign paused.',
  deleted: 'Campaign deleted.',
  kept: 'This campaign has payments, so it was paused instead of deleted (records keep their link).',
  'need-banner': 'Add banner text before activating a seasonal sale.',
};

type Status = 'live' | 'scheduled' | 'ended' | 'paused';
const TONE: Record<Status, 'green' | 'blue' | 'red' | 'slate'> = { live: 'green', scheduled: 'blue', ended: 'red', paused: 'slate' };

function status(c: Campaign, now = new Date()): Status {
  if (!c.isActive) return 'paused';
  if (c.startsAt && c.startsAt > now) return 'scheduled';
  if (c.endsAt && c.endsAt < now) return 'ended';
  return 'live';
}

function schedule(c: Campaign) {
  const parts: string[] = [];
  if (c.type === 'WELCOME' && c.durationHours) parts.push(`${c.durationHours} h after sign-up`);
  if (c.startsAt || c.endsAt) parts.push(`${c.startsAt ? formatDate(c.startsAt) : '…'} – ${c.endsAt ? formatDate(c.endsAt) : '…'}`);
  if (!parts.length) parts.push('always on while active');
  return parts.join(' · ');
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—');

export default async function CampaignsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [campaigns, plans, pays, templates, winbackSent, referralRewards] = await Promise.all([
    db.campaign.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }] }),
    db.plan.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.payment.groupBy({ by: ['campaignId', 'status'], where: { campaignId: { not: null } }, _count: true, _sum: { finalAmountUzs: true, discountUzs: true } }),
    db.messageTemplate.findMany({ where: { channel: 'SMS', lang: 'uz', key: { in: ['WELCOME', 'WINBACK', 'REFERRAL'] } } }),
    db.messageLog.count({ where: { key: 'WINBACK', channel: 'SMS' } }),
    db.referralReward.count(),
  ]);

  const report = new Map<string, { checkouts: number; paid: number; revenue: number; discount: number }>();
  for (const p of pays) {
    const r = report.get(p.campaignId!) ?? { checkouts: 0, paid: 0, revenue: 0, discount: 0 };
    r.checkouts += p._count;
    if (p.status === 'PAID') {
      r.paid += p._count;
      r.revenue += p._sum.finalAmountUzs ?? 0;
      r.discount += p._sum.discountUzs ?? 0;
    }
    report.set(p.campaignId!, r);
  }
  const totals = [...report.values()].reduce((a, r) => ({ paid: a.paid + r.paid, revenue: a.revenue + r.revenue, discount: a.discount + r.discount, checkouts: a.checkouts + r.checkouts }), { paid: 0, revenue: 0, discount: 0, checkouts: 0 });
  const tplBody = new Map(templates.map((t) => [t.key, t.body]));
  const editing = sp.edit === 'new' ? null : campaigns.find((c) => c.id === sp.edit);
  const showForm = sp.edit === 'new' || !!editing;
  const live = campaigns.filter((c) => status(c) === 'live');
  const msgTone = sp.msg === 'need-banner' ? 'bg-red-500/10 text-red-700' : sp.msg === 'kept' ? 'bg-amber-100 text-amber-800' : 'bg-mint-500/10 text-mint-700';

  return (
    <>
      <PageHeader
        title="Campaigns"
        desc="Automatic discounts. Only the single best discount applies to a purchase; a promo code replaces it unless the code is marked combinable."
        actions={<Link href="/admin/campaigns?edit=new#form" className="btn-primary btn-sm">+ New campaign</Link>}
      />
      {sp.msg && MESSAGES[sp.msg] && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${msgTone}`}>{MESSAGES[sp.msg]}</p>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Live now" value={live.length} hint={live.map((c) => c.name).join(', ') || 'none'} />
        <Stat label="Paid with a campaign" value={totals.paid} hint={`${pct(totals.paid, totals.checkouts)} of ${totals.checkouts} checkouts`} />
        <Stat label="Revenue after discounts" value={`${formatUzs(totals.revenue)} so'm`} />
        <Stat label="Discount given" value={`${formatUzs(totals.discount)} so'm`} />
      </div>

      <section className="mb-8" aria-labelledby="presets-h">
        <h2 id="presets-h" className="mb-1 text-lg font-bold">Presets</h2>
        <p className="mb-3 text-sm muted">Each preset creates an inactive draft with the discount, dates and banner filled in; adjust and activate.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PRESETS.map((p) => (
            <form key={p.id} action={applyCampaignPreset}>
              <input type="hidden" name="preset" value={p.id} />
              <button className="card flex h-full w-full items-start gap-3 p-4 text-left transition hover:border-brand-400">
                <span className="text-2xl" aria-hidden>{p.icon}</span>
                <span>
                  <span className="block font-semibold">{p.name}</span>
                  <span className="text-xs muted">{p.desc}</span>
                </span>
              </button>
            </form>
          ))}
        </div>
      </section>

      {showForm && (
        <section id="form" className="card mb-8 scroll-mt-6 p-5" aria-labelledby="form-h">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="form-h" className="text-lg font-bold">{editing ? `Edit: ${editing.name}` : 'New campaign'}</h2>
            <Link href="/admin/campaigns" className="btn-ghost btn-sm">Close</Link>
          </div>
          {editing?.type === 'PARTNER' && (
            <p className="mb-4 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-800">
              Partner campaigns are no longer applied automatically. Use <Link href="/admin/promo?preset=school#new" className="underline">bulk promo codes</Link> for partners.
            </p>
          )}
          <CampaignForm
            key={editing?.id ?? 'new'}
            plans={plans.map((p) => ({ value: p.slug, label: p.labelUz }))}
            defaults={
              editing
                ? {
                    id: editing.id, name: editing.name, type: editing.type === 'PARTNER' ? 'SEASONAL' : editing.type, discountPct: String(editing.discountPct),
                    durationHours: editing.durationHours != null ? String(editing.durationHours) : '', startsAt: toTashkentInput(editing.startsAt), endsAt: toTashkentInput(editing.endsAt),
                    bannerUz: editing.bannerUz, bannerCy: editing.bannerCy, bannerRu: editing.bannerRu, planSlugs: editing.planSlugs, isActive: editing.isActive,
                  }
                : { type: 'SEASONAL' }
            }
          />
          {editing && TEMPLATE_FOR[editing.type] && tplBody.get(TEMPLATE_FOR[editing.type]!) && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide muted">Message sent with this campaign (SMS, uz)</p>
              <p className="mt-1 font-mono text-xs">{tplBody.get(TEMPLATE_FOR[editing.type]!)}</p>
              <p className="mt-1 text-xs muted">Editable in Message templates.</p>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="list-h">
        <h2 id="list-h" className="mb-3 text-lg font-bold">All campaigns</h2>
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Campaign</th><th>Discount</th><th>Schedule</th><th>Banner</th><th>Paid / checkouts</th><th>Revenue</th><th>Discount given</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {campaigns.length === 0 && <tr><td colSpan={9} className="py-6 text-center muted">No campaigns yet. Start from a preset above.</td></tr>}
              {campaigns.map((c) => {
                const r = report.get(c.id) ?? { checkouts: 0, paid: 0, revenue: 0, discount: 0 };
                const st = status(c);
                const extra = c.type === 'WINBACK' ? `${winbackSent} win-back SMS sent` : c.type === 'REFERRAL' ? `${referralRewards} referrer rewards` : null;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/campaigns?edit=${c.id}#form`} className="font-semibold hover:underline">{c.name}</Link>
                      <p className="text-xs muted">{TYPE_LABEL[c.type]}{c.planSlugs.length ? ` · ${c.planSlugs.join(', ')}` : ''}</p>
                    </td>
                    <td className="font-semibold">−{c.discountPct}%</td>
                    <td className="text-xs">{schedule(c)}</td>
                    <td className="max-w-[14rem] truncate text-xs muted" title={c.bannerUz}>{c.type === 'SEASONAL' ? c.bannerUz || <span className="text-red-600">missing</span> : c.type === 'WELCOME' ? 'countdown (automatic)' : '—'}</td>
                    <td className="tabular-nums">{r.paid} / {r.checkouts} <span className="text-xs muted">({pct(r.paid, r.checkouts)})</span>{extra && <p className="text-xs muted">{extra}</p>}</td>
                    <td className="tabular-nums">{formatUzs(r.revenue)}</td>
                    <td className="tabular-nums">{formatUzs(r.discount)}</td>
                    <td><Badge tone={TONE[st]}>{st}</Badge></td>
                    <td className="whitespace-nowrap">
                      <div className="flex gap-1">
                        <Link href={`/admin/campaigns?edit=${c.id}#form`} className="btn-ghost btn-sm">Edit</Link>
                        <form action={campaignAction}>
                          <input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="toggle" />
                          <button className="btn-ghost btn-sm">{c.isActive ? 'Pause' : 'Activate'}</button>
                        </form>
                        <form action={campaignAction}>
                          <input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="delete" />
                          <button className="btn-ghost btn-sm text-red-600" aria-label={`Delete ${c.name}`}>Delete</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs muted">“Paid / checkouts” counts payments where this campaign was the discount applied. A non-combinable promo code replaces the campaign, so those payments count for the code instead.</p>
      </section>
    </>
  );
}
