'use client';

import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

/**
 * Bottom sheet on phones, centred dialog on larger screens. Built on <dialog> so focus is
 * trapped, Esc closes it and the page behind is inert.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-label={title}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-card border border-line bg-surface p-0 text-ink shadow-raised backdrop:bg-black/60
        open:animate-sheet-up sm:m-auto sm:max-w-lg sm:rounded-card sm:open:animate-fade-up"
    >
      <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
      <div className="sticky top-0 z-10 flex items-center justify-between bg-surface px-4 pb-2 pt-1">
        <h2 className="text-h2">{title}</h2>
        <button type="button" onClick={onClose} className="grid h-12 w-12 place-items-center rounded-xl text-muted hover:bg-raised" aria-label="×">
          <Icon name="close" />
        </button>
      </div>
      <div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
