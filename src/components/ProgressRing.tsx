'use client';

import { useEffect, useState } from 'react';

/**
 * Circular progress with an animated fill and count-up on first view.
 * Server-rendered at the final value (no layout shift); the animation only replays on the client
 * and is skipped when the user prefers reduced motion.
 */
export function ProgressRing({
  value,
  size = 140,
  stroke = 12,
  label,
  sub,
  tone = 'brand',
  onBrand = false,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
  tone?: 'brand' | 'mint' | 'cta' | 'red';
  /** On a brand-blue surface: white text, translucent track, green fill. */
  onBrand?: boolean;
}) {
  const target = Math.max(0, Math.min(100, value));
  const [shown, setShown] = useState(target);
  useEffect(() => {
    // Count-up only when the page is visible and motion is welcome; always ends on the real value.
    if (document.visibilityState !== 'visible' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      setShown(target * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    const done = setTimeout(() => setShown(target), 900);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [target]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (target / 100) * c;
  const color = onBrand ? 'stroke-accent' : { brand: 'stroke-brand-600', mint: 'stroke-accent', cta: 'stroke-warning', red: 'stroke-danger' }[tone];
  const track = onBrand ? 'stroke-white/20' : 'stroke-raised';
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${sub ?? ''} ${label ?? `${Math.round(target)}%`}`.trim()}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className={`fill-none ${track}`} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={`fill-none ${color} motion-safe:animate-[ring-fill_.8s_ease-out_both]`}
          style={{ ['--ring-from' as string]: c, ['--ring-to' as string]: offset }}
        />
      </svg>
      <div className="absolute text-center" aria-hidden>
        <div className={`num font-extrabold leading-none ${onBrand ? 'text-white' : 'text-ink'}`} style={{ fontSize: size / 4.4 }}>
          {label ?? `${Math.round(shown)}%`}
        </div>
        {sub && <div className={`mt-1 text-xs ${onBrand ? 'text-white/80' : 'text-muted'}`}>{sub}</div>}
      </div>
    </div>
  );
}
