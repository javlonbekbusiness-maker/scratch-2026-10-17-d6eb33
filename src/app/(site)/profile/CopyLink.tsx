'use client';

import { useState } from 'react';

export function CopyLink({ url, labels }: { url: string; labels: { copy: string; copied: string } }) {
  const [done, setDone] = useState(false);
  return (
    <div className="mt-3 flex gap-2">
      <input readOnly value={url} className="input text-sm" aria-label="Referral link" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="btn-primary shrink-0"
        onClick={async () => {
          try { await navigator.clipboard.writeText(url); } catch {}
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }}
      >
        {done ? labels.copied : labels.copy}
      </button>
    </div>
  );
}
