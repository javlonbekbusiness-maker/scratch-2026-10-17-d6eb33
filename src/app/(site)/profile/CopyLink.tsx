'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export function CopyLink({ url, labels }: { url: string; labels: { copy: string; copied: string; field: string } }) {
  const [done, setDone] = useState(false);
  return (
    <div className="mt-3 flex gap-2">
      <input readOnly value={url} className="input num min-w-0 text-sm" aria-label={labels.field} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className={done ? 'btn-success shrink-0' : 'btn-primary shrink-0'}
        onClick={async () => {
          try { await navigator.clipboard.writeText(url); } catch {}
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }}
      >
        <Icon name={done ? 'check' : 'note'} size={18} />
        <span aria-live="polite">{done ? labels.copied : labels.copy}</span>
      </button>
    </div>
  );
}
