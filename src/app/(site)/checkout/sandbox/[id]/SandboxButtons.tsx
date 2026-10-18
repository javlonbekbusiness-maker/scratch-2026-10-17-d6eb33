'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SandboxButtons({ paymentId, labels }: { paymentId: string; labels: { ok: string; fail: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go(outcome: 'success' | 'fail') {
    setBusy(true);
    await fetch('/api/payments/sandbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId, outcome }) });
    router.replace(`/checkout/result/${paymentId}`);
    router.refresh();
  }
  return (
    <div className="grid gap-2">
      <button disabled={busy} onClick={() => go('success')} className="btn-cta w-full">✓ {labels.ok}</button>
      <button disabled={busy} onClick={() => go('fail')} className="btn-secondary w-full">✕ {labels.fail}</button>
    </div>
  );
}
