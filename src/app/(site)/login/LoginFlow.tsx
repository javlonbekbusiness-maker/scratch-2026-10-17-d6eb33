'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';
import { PhoneForm } from '@/components/PhoneForm';
import { formatPhone } from '@/lib/phone';

type Pending = { phone: string; resendAt: number; devCode?: string };

/** Only same-origin paths; "//host" would be protocol-relative. */
function nextParam() {
  const n = new URLSearchParams(window.location.search).get('next');
  return n && n.startsWith('/') && !n.startsWith('//') ? n : null;
}

export function LoginFlow({ step }: { step: 'phone' | 'otp' | 'email' }) {
  const { t } = useT();
  if (step === 'otp') return <OtpStep />;
  if (step === 'email') return <EmailStep />;
  return (
    <>
      <h1 className="text-2xl font-bold">{t('auth.phoneTitle')}</h1>
      <p className="mb-6 mt-1 muted">{t('auth.phoneSubtitle')}</p>
      <PhoneForm />
      <Link href="/login?step=email" className="mt-2 block text-center text-sm font-medium text-brand-fg hover:underline">
        {t('auth.emailLogin')}
      </Link>
    </>
  );
}

function OtpStep() {
  const { t } = useT();
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('otp');
    if (!raw) return router.replace('/login');
    setPending(JSON.parse(raw));
    inputRef.current?.focus();
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [router]);

  async function verify(value: string) {
    if (!pending || value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: pending.phone, code: value }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(t(j.error === 'expired' ? 'auth.otpExpired' : j.error === 'locked' ? 'auth.otpLocked' : 'auth.otpInvalid'));
        setCode('');
        // Keep the cursor in the field so the user can retype straight away.
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }
      sessionStorage.removeItem('otp');
      const next = nextParam();
      router.replace(j.onboarded && next ? next : j.next);
      router.refresh();
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!pending) return;
    const r = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: pending.phone, consent: true }),
    });
    const j = await r.json();
    if (!r.ok) return setError(t('auth.tooMany', { s: j.retryAfter ?? 60 }));
    const p = { ...pending, resendAt: Date.now() + j.resendIn * 1000, devCode: j.devCode };
    sessionStorage.setItem('otp', JSON.stringify(p));
    setPending(p);
    setError(null);
  }

  if (!pending) return <p className="muted">{t('common.loading')}</p>;
  const wait = Math.max(0, Math.ceil((pending.resendAt - now) / 1000));

  return (
    <>
      <h1 className="text-2xl font-bold">{t('auth.otpTitle')}</h1>
      <p className="mb-6 mt-1 muted">{t('auth.otpSubtitle', { phone: formatPhone(pending.phone) })}</p>
      {pending.devCode && (
        <p className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink">
          {t('auth.devCode', { code: pending.devCode })}
        </p>
      )}
      <form onSubmit={(e) => { e.preventDefault(); verify(code); }}>
        <label htmlFor="otp" className="sr-only">{t('auth.otpTitle')}</label>
        <input
          ref={inputRef}
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(v);
            if (v.length === 6) verify(v);
          }}
          className={`input h-16 text-center font-mono text-3xl tracking-[0.5em] ${error ? 'animate-shake border-danger' : ''}`}
          placeholder="••••••"
          aria-invalid={!!error}
          aria-describedby="otp-err"
        />
        <p id="otp-err" role="alert" className="mt-2 min-h-[1.25rem] text-sm font-medium text-danger">{error}</p>
        <button type="submit" disabled={busy || code.length !== 6} className="btn-primary mt-2 w-full">
          {busy ? t('common.loading') : t('auth.verify')}
        </button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <button type="button" onClick={() => router.replace('/login')} className="font-medium text-muted hover:underline">
          ← {t('auth.changePhone')}
        </button>
        {wait > 0 ? (
          <span className="tabular-nums muted">{t('auth.resendIn', { s: wait })}</span>
        ) : (
          <button type="button" onClick={resend} className="font-semibold text-brand-fg hover:underline">
            {t('auth.resend')}
          </button>
        )}
      </div>
    </>
  );
}

function EmailStep() {
  const { t } = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/login-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      });
      if (r.status === 429) {
        const j = await r.json().catch(() => ({}));
        return setError(t('auth.tooMany', { s: j.retryAfter ?? 60 }));
      }
      if (!r.ok) return setError(t('auth.wrongCredentials'));
      router.replace(nextParam() ?? '/dashboard');
      router.refresh();
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{t('auth.emailLogin')}</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">{t('auth.email')}</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">{t('auth.password')}</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        <p role="alert" className="min-h-[1.25rem] text-sm font-medium text-danger">{error}</p>
        <button disabled={busy} className="btn-primary w-full">{t('common.login')}</button>
      </form>
      <Link href="/login" className="mt-4 block text-center text-sm font-medium text-brand-fg hover:underline">
        {t('auth.phoneLogin')}
      </Link>
    </>
  );
}
