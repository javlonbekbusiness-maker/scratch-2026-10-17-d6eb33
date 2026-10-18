'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';
import type { MessageKey } from '@/i18n/translate';
import type { PlanView } from '@/lib/plans-view';
import type { DiscountLine } from '@/lib/pricing';
import { formatUzs } from '@/lib/format';

type QuoteRes = {
  amountUzs: number;
  lines: DiscountLine[];
  discountUzs: number;
  finalAmountUzs: number;
  bonusDays: number;
  promoError: string | null;
  trialDays: number | null;
  promo: { code: string; type: string; value: number } | null;
};

const PROVIDERS = [
  { id: 'CLICK', name: 'Click', color: 'bg-[#00a3ff]' },
  { id: 'PAYME', name: 'Payme', color: 'bg-[#33cccc]' },
  { id: 'UZUM', name: 'Uzum', color: 'bg-[#7000ff]' },
] as const;

export function Checkout({ plans, initialPlan, initialCode }: { plans: PlanView[]; initialPlan: string; initialCode: string }) {
  const { t } = useT();
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [codeInput, setCodeInput] = useState(initialCode);
  const [code, setCode] = useState<string | null>(initialCode || null);
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]['id']>('CLICK');
  const [q, setQ] = useState<QuoteRes | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const soum = t('common.soum');
  const money = (n: number) => `${formatUzs(n)} ${soum}`;

  const load = useCallback(
    async (planSlug: string, c: string | null) => {
      const r = await fetch('/api/promo/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planSlug, code: c }) });
      const j = await r.json();
      if (!r.ok) {
        setMsg({ ok: false, text: t(j.error === 'promoTooMany' ? 'pricing.promoTooMany' : 'common.error') });
        return;
      }
      setQ(j);
      if (!c) return;
      if (j.promoError) {
        setMsg({ ok: false, text: t(`pricing.${j.promoError}` as MessageKey, { amount: j.promoMinOrderUzs ? money(j.promoMinOrderUzs) : '' }) });
        setCode(null);
      } else if (j.trialDays) setMsg({ ok: true, text: t('pricing.promoTrialHint', { n: j.trialDays }) });
      else if (j.promo) {
        const label = j.promo.type === 'PERCENT' ? `−${j.promo.value}%` : j.promo.type === 'FIXED' ? `−${money(j.promo.value)}` : t('pricing.promoBonusDays', { n: j.promo.value });
        setMsg({ ok: true, text: t('pricing.promoApplied', { d: label }) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  useEffect(() => { if (plan) load(plan, code); }, [plan, code, load]);

  async function pay() {
    setBusy(true);
    const r = await fetch('/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planSlug: plan, provider, code }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: t(j.error?.startsWith('promo') ? (`pricing.${j.error}` as MessageKey) : 'common.error', { amount: '' }) });
    router.push(j.redirectUrl);
  }

  async function activateTrial() {
    setBusy(true);
    const r = await fetch('/api/promo/redeem-trial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: t(`pricing.${j.error}` as MessageKey, { amount: '' }) });
    setMsg({ ok: true, text: t('pricing.promoTrialOk', { n: j.days }) });
    setTimeout(() => { router.push('/tests'); router.refresh(); }, 1200);
  }

  const lineLabel = (l: DiscountLine) =>
    l.source === 'PROMO' ? t('pricing.discPromo', { code: l.code ?? '' }) : l.source === 'REFERRAL' ? t('pricing.discReferral') : l.source === 'WELCOME' ? t('pricing.discWelcome') : t('pricing.discCampaign');

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_380px]">
      <fieldset>
        <legend className="sr-only">{t('pricing.title')}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((p) => (
            <label key={p.id} className="cursor-pointer">
              <input type="radio" name="plan" value={p.slug} checked={plan === p.slug} onChange={() => setPlan(p.slug)} className="peer sr-only" />
              <div className={`card relative h-full p-5 transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 ${plan === p.slug ? 'border-2 border-brand-500 bg-brand-50/50 dark:bg-brand-950/40' : 'border-2 hover:border-brand-300'}`}>
                {p.featured && <span className="chip absolute -top-3 right-4 bg-brand-600 text-white">⭐ {t('pricing.bestValue')}</span>}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold">{p.label}</p>
                    {p.untilPass && <p className="text-xs muted">{t('pricing.untilPassNote')}</p>}
                  </div>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${plan === p.slug ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`} aria-hidden>
                    {plan === p.slug && '✓'}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-extrabold tabular-nums">{money(p.finalUzs)}</p>
                {p.discountPct > 0 && <p className="text-sm"><s className="muted">{money(p.priceUzs)}</s> <span className="font-semibold text-cta-600">−{p.discountPct}%</span></p>}
                <p className="text-xs muted">{t('pricing.perDay', { p: money(Math.round(p.finalUzs / p.durationDays)) })}</p>
                {p.saving > 0 && <span className="chip mt-2 bg-mint-500/15 text-mint-700 dark:text-mint-300">{t('pricing.save', { p: p.saving })}</span>}
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <aside className="card h-fit p-5 lg:sticky lg:top-24" aria-label={t('pricing.total')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = codeInput.trim() || null;
            if (next === code) load(plan, code);
            else setCode(next);
          }}
          className="flex gap-2"
        >
          <label htmlFor="promo" className="sr-only">{t('pricing.promoLabel')}</label>
          <input id="promo" value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder={t('pricing.promoPlaceholder')} className="input uppercase" maxLength={40} autoComplete="off" />
          {code ? (
            <button type="button" className="btn-secondary px-3" onClick={() => { setCode(null); setCodeInput(''); setMsg(null); }}>{t('pricing.remove')}</button>
          ) : (
            <button className="btn-secondary px-4">{t('pricing.apply')}</button>
          )}
        </form>
        <p role="status" className={`mt-2 min-h-[1.25rem] text-sm font-medium ${msg?.ok ? 'text-mint-700 dark:text-mint-400' : 'text-red-600'}`}>{msg?.text}</p>

        {q?.trialDays ? (
          <button onClick={activateTrial} disabled={busy} className="btn-cta mt-2 w-full">{t('pricing.activateTrial')}</button>
        ) : (
          q && (
            <>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="muted">{t('pricing.original')}</dt><dd className="tabular-nums">{money(q.amountUzs)}</dd></div>
                {q.lines.map((l, i) => (
                  <div key={i} className="flex justify-between text-cta-700 dark:text-cta-400">
                    <dt>{lineLabel(l)}{l.pct ? ` (−${l.pct}%)` : ''}</dt>
                    <dd className="tabular-nums">−{money(l.amountUzs)}</dd>
                  </div>
                ))}
                {q.bonusDays > 0 && (
                  <div className="flex justify-between text-mint-700 dark:text-mint-400"><dt>{t('pricing.discPromo', { code: q.promo?.code ?? '' })}</dt><dd>{t('pricing.promoBonusDays', { n: q.bonusDays })}</dd></div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-extrabold dark:border-slate-700">
                  <dt>{t('pricing.total')}</dt><dd className="tabular-nums">{money(q.finalAmountUzs)}</dd>
                </div>
              </dl>

              {q.finalAmountUzs > 0 && (
                <fieldset className="mt-5">
                  <legend className="label">{t('pricing.payWith')}</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {PROVIDERS.map((p) => (
                      <label key={p.id} className="cursor-pointer">
                        <input type="radio" name="provider" value={p.id} checked={provider === p.id} onChange={() => setProvider(p.id)} className="peer sr-only" />
                        <span className={`flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 text-sm font-bold peer-focus-visible:ring-2 ${provider === p.id ? 'border-brand-500' : 'border-slate-200 dark:border-slate-700'}`}>
                          <span className={`h-3 w-3 rounded-full ${p.color}`} aria-hidden />{p.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <button onClick={pay} disabled={busy || !plan} className="btn-cta mt-5 w-full">
                {busy ? t('common.loading') : t('pricing.pay', { amount: money(q.finalAmountUzs) })}
              </button>
              <p className="mt-3 text-center text-xs muted">🔒 {t('pricing.secure')}<br />{t('pricing.receiptNote')}</p>
            </>
          )
        )}
      </aside>
    </div>
  );
}
