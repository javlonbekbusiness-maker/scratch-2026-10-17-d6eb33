import { ProgressRing } from '@/components/ProgressRing';
import { ProgressBar } from './Primitives';

/**
 * Home hero: readiness ring, one primary action and the daily goal.
 * `action` is the primary control (a link or a form), so the card stays presentational.
 */
export function HeroCard({
  readiness,
  title,
  hint,
  action,
  actionHint,
  goal,
}: {
  readiness: number;
  title: string;
  hint: string;
  action: React.ReactNode;
  actionHint?: string;
  goal: { label: string; value: number; max: number; text: string; done: boolean };
}) {
  return (
    <section
      className="relative overflow-hidden rounded-card border border-brand-500/30 bg-gradient-to-br from-brand-700 via-brand-600 to-[#2a7be6] p-5 text-white shadow-glow sm:p-6"
      aria-labelledby="hero-h"
    >
      {/* Soft road lines in the background; decorative only. */}
      <svg className="pointer-events-none absolute -right-10 -top-6 h-48 w-48 opacity-20" viewBox="0 0 200 200" aria-hidden>
        <path d="M30 200 C 70 120, 120 90, 200 70" stroke="white" strokeWidth="26" fill="none" strokeLinecap="round" />
        <path d="M30 200 C 70 120, 120 90, 200 70" stroke="#0e1730" strokeWidth="3" strokeDasharray="12 12" fill="none" />
      </svg>
      <div className="relative flex items-center gap-4 sm:gap-6">
        <div className="shrink-0 rounded-full bg-white/10 p-1.5">
          <ProgressRing value={readiness} size={108} stroke={10} onBrand />
        </div>
        <div className="min-w-0">
          <h2 id="hero-h" className="text-h2">{title}</h2>
          <p className="mt-1 text-small text-white/80">{hint}</p>
        </div>
      </div>
      <div className="relative mt-5">{action}</div>
      {actionHint && <p className="relative mt-2 truncate text-center text-small text-white/80">{actionHint}</p>}
      <div className="relative mt-5 rounded-2xl bg-black/15 p-3">
        <div className="mb-2 flex items-center justify-between text-small">
          <span className="font-semibold">{goal.label}</span>
          <span className="num font-semibold">{goal.text}</span>
        </div>
        <ProgressBar value={goal.value} max={goal.max} label={goal.label} tone="accent" onBrand />
      </div>
    </section>
  );
}
