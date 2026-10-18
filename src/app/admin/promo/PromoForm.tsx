'use client';

import { useActionState, useState } from 'react';
import { bulkGeneratePromos, savePromo, type PromoFormState } from '../actions';

type Opt = { value: string; label: string };
export type PromoDefaults = Partial<{
  id: string;
  code: string;
  type: string;
  value: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perUserLimit: string;
  minOrderUzs: string;
  planSlugs: string[];
  newUsersOnly: boolean;
  combinable: boolean;
  partnerId: string;
  note: string;
  isActive: boolean;
  oneTime: boolean;
  count: string;
  prefix: string;
}>;

const TYPES = [
  { value: 'PERCENT', label: 'Percentage off', unit: '%' },
  { value: 'FIXED', label: 'Fixed amount off', unit: "so'm" },
  { value: 'FREE_DAYS', label: 'Free days added to purchase', unit: 'days' },
  { value: 'FREE_TRIAL', label: 'Free trial (no payment)', unit: 'days' },
];

const inp = 'input min-h-[40px] rounded-xl px-3 text-sm';

export function PromoForm({ mode, defaults = {}, plans, partners }: { mode: 'create' | 'edit' | 'bulk'; defaults?: PromoDefaults; plans: Opt[]; partners: Opt[] }) {
  const [state, action, pending] = useActionState<PromoFormState, FormData>(mode === 'bulk' ? bulkGeneratePromos : savePromo, null);
  // After a failed submit, show what the admin typed (React resets the form after every action).
  const v = (k: keyof PromoDefaults) => {
    const sv = state?.values[k];
    if (sv !== undefined) return Array.isArray(sv) ? sv : String(sv);
    const dv = defaults[k];
    return dv === undefined ? '' : dv;
  };
  const checked = (k: keyof PromoDefaults) => (state ? state.values[k] === 'on' : !!defaults[k]);
  const planChecked = (slug: string) => {
    const list = (state ? state.values.planSlugs : defaults.planSlugs) ?? [];
    return (Array.isArray(list) ? list : [list]).includes(slug);
  };
  const [type, setType] = useState(String(v('type') || 'PERCENT'));
  const unit = TYPES.find((t) => t.value === type)?.unit ?? '';
  const isTrial = type === 'FREE_TRIAL';

  return (
    <form key={state?.attempt ?? 0} action={action} className="space-y-4">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mode === 'create' && (
          <label className="block">
            <span className="label">Code</span>
            <input name="code" required maxLength={40} defaultValue={String(v('code'))} placeholder="NAVRUZ25" className={`${inp} font-mono uppercase`} autoComplete="off" />
          </label>
        )}
        {mode === 'bulk' && (
          <>
            <label className="block">
              <span className="label">How many codes</span>
              <input name="count" type="number" min={1} max={5000} required defaultValue={String(v('count') || '100')} className={inp} />
            </label>
            <label className="block">
              <span className="label">Prefix (optional)</span>
              <input name="prefix" maxLength={12} defaultValue={String(v('prefix'))} placeholder="SCHOOL1-" className={`${inp} font-mono uppercase`} />
            </label>
          </>
        )}
        {mode === 'edit' && (
          <div>
            <span className="label">Code</span>
            <p className="flex min-h-[40px] items-center font-mono text-lg font-bold">{defaults.code}</p>
          </div>
        )}
        <label className="block">
          <span className="label">Type</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inp}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Value ({unit})</span>
          <input name="value" type="number" min={1} required defaultValue={String(v('value'))} className={inp} />
        </label>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide muted">Validity (Tashkent time)</legend>
        <label className="block">
          <span className="label">Starts</span>
          <input name="startsAt" type="datetime-local" defaultValue={String(v('startsAt'))} className={inp} />
        </label>
        <label className="block">
          <span className="label">Ends</span>
          <input name="endsAt" type="datetime-local" defaultValue={String(v('endsAt'))} className={inp} />
        </label>
        {mode !== 'bulk' && (
          <>
            <label className="block">
              <span className="label">Total usage limit</span>
              <input name="usageLimit" type="number" min={1} defaultValue={String(v('usageLimit'))} placeholder="Unlimited" className={inp} />
            </label>
            <label className="block">
              <span className="label">Per-user limit</span>
              <input name="perUserLimit" type="number" min={1} defaultValue={String(v('perUserLimit') || '1')} className={inp} />
            </label>
          </>
        )}
      </fieldset>

      <fieldset className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide muted">Rules</legend>
        {!isTrial && (
          <label className="block">
            <span className="label">Minimum order (so&apos;m)</span>
            <input name="minOrderUzs" type="number" min={0} defaultValue={String(v('minOrderUzs'))} placeholder="None" className={inp} />
          </label>
        )}
        <label className="block">
          <span className="label">Partner (for tracking)</span>
          <select name="partnerId" defaultValue={String(v('partnerId'))} className={inp}>
            <option value="">— none —</option>
            {partners.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Internal note</span>
          <input name="note" maxLength={200} defaultValue={String(v('note'))} className={inp} />
        </label>
      </fieldset>

      {!isTrial && (
        <fieldset>
          <legend className="label">Applies to plans <span className="font-normal muted">(none ticked = all plans)</span></legend>
          <div className="flex flex-wrap gap-2">
            {plans.map((p) => (
              <label key={p.value} className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm dark:border-slate-700">
                <input type="checkbox" name="planSlugs" value={p.value} defaultChecked={planChecked(p.value)} className="h-4 w-4" />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="newUsersOnly" defaultChecked={checked('newUsersOnly')} className="h-4 w-4" /> New users only (no previous purchase)</label>
        {!isTrial && (
          <label className="flex items-center gap-2"><input type="checkbox" name="combinable" defaultChecked={checked('combinable')} className="h-4 w-4" /> Can combine with automatic discounts</label>
        )}
        {mode === 'create' && (
          <label className="flex items-center gap-2"><input type="checkbox" name="oneTime" defaultChecked={checked('oneTime')} className="h-4 w-4" /> One-time (total limit 1)</label>
        )}
        {mode === 'edit' && (
          <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={checked('isActive')} className="h-4 w-4" /> Active</label>
        )}
      </div>
      {mode === 'bulk' && <p className="text-xs muted">Each generated code is single-use (total limit 1, per-user limit 1).</p>}

      <button disabled={pending} className="btn-primary btn-sm">
        {pending ? 'Saving…' : mode === 'bulk' ? 'Generate codes' : mode === 'edit' ? 'Save changes' : 'Create code'}
      </button>
    </form>
  );
}
