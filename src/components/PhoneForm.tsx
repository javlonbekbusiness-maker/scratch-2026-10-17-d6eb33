'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';
import { maskLocalDigits } from '@/lib/phone';

export function PhoneForm({ compact = false, initial = '' }: { compact?: boolean; initial?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [digits, setDigits] = useState(initial.replace(/\D/g, '').replace(/^998/, '').slice(0, 9));
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (digits.length !== 9) return setError(t('auth.phoneInvalid'));
    if (!consent) return setError(t('auth.consentRequired'));
    setBusy(true);
    try {
      const r = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+998' + digits, consent }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error === 'too_many' ? t('auth.tooMany', { s: j.retryAfter }) : j.error === 'phone' ? t('auth.phoneInvalid') : t('common.error'));
        return;
      }
      sessionStorage.setItem('otp', JSON.stringify({ phone: '+998' + digits, resendAt: Date.now() + j.resendIn * 1000, devCode: j.devCode }));
      const next = new URLSearchParams(window.location.search).get('next');
      router.push('/login?step=otp' + (next ? `&next=${encodeURIComponent(next)}` : ''));
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <label htmlFor="phone" className={compact ? 'sr-only' : 'label'}>
        {t('auth.phoneLabel')}
      </label>
      <div className={`flex gap-2 ${compact ? 'flex-col sm:flex-row' : 'flex-col'}`}>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-500">+998</span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="90 123 45 67"
            value={maskLocalDigits(digits)}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').replace(/^998/, '').slice(0, 9))}
            className="input h-14 pl-[4.25rem] text-lg tracking-wide"
            aria-invalid={!!error}
            aria-describedby="phone-err"
          />
        </div>
        <button type="submit" disabled={busy} className={`btn-cta h-14 ${compact ? 'sm:px-8' : 'w-full'}`}>
          {busy ? t('common.loading') : compact ? t('landing.heroCta') : t('auth.sendCode')}
        </button>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600" />
        <span className="muted">
          {t('auth.consent')} (
          <Link href="/privacy" className="underline" target="_blank">{t('legal.privacyTitle')}</Link>,{' '}
          <Link href="/terms" className="underline" target="_blank">{t('legal.termsTitle')}</Link>)
        </span>
      </label>
      <p id="phone-err" role="alert" className="min-h-[1.25rem] pb-3 text-sm font-medium text-red-600">{error}</p>
    </form>
  );
}
