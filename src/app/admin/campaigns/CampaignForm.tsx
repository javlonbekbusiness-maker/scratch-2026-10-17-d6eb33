'use client';

import { useActionState, useState } from 'react';
import { saveCampaign, type CampaignFormState } from '../actions';

export type CampaignDefaults = Partial<{
  id: string;
  name: string;
  type: string;
  discountPct: string;
  durationHours: string;
  startsAt: string;
  endsAt: string;
  bannerUz: string;
  bannerCy: string;
  bannerRu: string;
  planSlugs: string[];
  isActive: boolean;
}>;

const TYPES = [
  { value: 'SEASONAL', label: 'Seasonal sale', help: 'Applies automatically to everyone between the start and end dates, with a site-wide banner and struck-through prices.' },
  { value: 'WELCOME', label: 'Welcome offer', help: 'Each new user gets this discount for N hours after verifying their phone, with a countdown banner. Ends at their first purchase.' },
  { value: 'REFERRAL', label: 'Referral reward', help: "Discount for a referred friend's first purchase. The referrer's free days are set in Settings." },
  { value: 'WINBACK', label: 'Win-back', help: 'Discount used for the single-use codes the reminders job sends to users whose access lapsed 7–30 days ago.' },
];

const inp = 'input min-h-[40px] rounded-xl px-3 text-sm';

export function CampaignForm({ defaults = {}, plans }: { defaults?: CampaignDefaults; plans: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<CampaignFormState, FormData>(saveCampaign, null);
  const v = (k: keyof CampaignDefaults) => {
    const sv = state?.values[k];
    if (sv !== undefined) return Array.isArray(sv) ? sv.join(',') : sv;
    const dv = defaults[k];
    return dv === undefined ? '' : String(dv);
  };
  const [type, setType] = useState(v('type') || 'SEASONAL');
  const [banner, setBanner] = useState({ uz: v('bannerUz'), cy: v('bannerCy'), ru: v('bannerRu') });
  const [previewLang, setPreviewLang] = useState<'uz' | 'cy' | 'ru'>('uz');
  const planChecked = (slug: string) => {
    const list = state ? state.values.planSlugs : defaults.planSlugs;
    return (Array.isArray(list) ? list : list ? [list] : []).includes(slug);
  };
  const isActive = state ? state.values.isActive === 'on' : !!defaults.isActive;
  const help = TYPES.find((t) => t.value === type)?.help;
  const needsDates = type === 'SEASONAL';
  const previewText = banner[previewLang] || (previewLang === 'cy' ? '(auto-transliterated from Uzbek)' : '');

  return (
    <form key={state?.attempt ?? 0} action={action} className="space-y-4">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {defaults.id && <input type="hidden" name="bannerUzPrev" value={defaults.bannerUz ?? ''} />}
      {state?.error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300">{state.error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block lg:col-span-2">
          <span className="label">Name (internal)</span>
          <input name="name" required maxLength={80} defaultValue={v('name')} className={inp} />
        </label>
        <label className="block">
          <span className="label">Type</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inp}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Discount (%)</span>
          <input name="discountPct" type="number" min={1} max={90} required defaultValue={v('discountPct')} className={inp} />
        </label>
      </div>
      {help && <p className="text-xs muted">{help}</p>}

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide muted">Schedule (Tashkent time)</legend>
        {type === 'WELCOME' && (
          <label className="block">
            <span className="label">Offer window after sign-up (hours)</span>
            <input name="durationHours" type="number" min={1} max={720} required defaultValue={v('durationHours') || '24'} className={inp} />
          </label>
        )}
        <label className="block">
          <span className="label">Starts {needsDates ? '' : <span className="font-normal muted">(optional)</span>}</span>
          <input name="startsAt" type="datetime-local" required={needsDates} defaultValue={v('startsAt')} className={inp} />
        </label>
        <label className="block">
          <span className="label">Ends {needsDates ? '' : <span className="font-normal muted">(optional)</span>}</span>
          <input name="endsAt" type="datetime-local" required={needsDates} defaultValue={v('endsAt')} className={inp} />
        </label>
      </fieldset>

      {(type === 'SEASONAL' || type === 'WELCOME') && (
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

      {type === 'SEASONAL' && (
        <fieldset className="space-y-3">
          <legend className="label">Site banner <span className="font-normal muted">(max 140 characters; Cyrillic is auto-filled from Uzbek if empty)</span></legend>
          <div className="grid gap-3 md:grid-cols-3">
            {(['uz', 'cy', 'ru'] as const).map((l) => (
              <label key={l} className="block">
                <span className="text-xs font-semibold muted">{l === 'uz' ? "O'zbek (lotin)" : l === 'cy' ? 'Ўзбек (кирилл)' : 'Русский'}</span>
                <input
                  name={`banner${l === 'uz' ? 'Uz' : l === 'cy' ? 'Cy' : 'Ru'}`}
                  maxLength={140}
                  value={banner[l]}
                  onChange={(e) => setBanner((b) => ({ ...b, [l]: e.target.value }))}
                  onFocus={() => setPreviewLang(l)}
                  className={inp}
                />
              </label>
            ))}
          </div>
          <div>
            <p className="mb-1 text-xs muted">Preview ({previewLang === 'uz' ? 'Uzbek' : previewLang === 'cy' ? 'Cyrillic' : 'Russian'}):</p>
            <div className="rounded-xl bg-gradient-to-r from-brand-600 to-mint-600 py-2 text-center text-sm font-semibold text-white" aria-live="polite">
              🎉 {previewText || <span className="opacity-70">Banner text appears here</span>} · 2d 4:12:09
            </div>
          </div>
        </fieldset>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={isActive} className="h-5 w-5" />
        <span><b>Active</b>: {needsDates ? 'runs automatically between the dates above.' : 'switches this campaign on; any other active campaign of the same type is switched off.'}</span>
      </label>

      <button disabled={pending} className="btn-primary btn-sm">{pending ? 'Saving…' : defaults.id ? 'Save campaign' : 'Create campaign'}</button>
    </form>
  );
}
