export function ProgressRing({
  value,
  size = 140,
  stroke = 12,
  label,
  sub,
  tone = 'brand',
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
  tone?: 'brand' | 'mint' | 'cta' | 'red';
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const color = { brand: 'stroke-brand-500', mint: 'stroke-mint-500', cta: 'stroke-cta-500', red: 'stroke-red-500' }[tone];
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? ''} ${Math.round(v)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-slate-200 dark:stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          className={`fill-none ${color} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-extrabold tabular-nums" style={{ fontSize: size / 4.6 }}>
          {label ?? `${Math.round(v)}%`}
        </div>
        {sub && <div className="mt-0.5 text-xs muted">{sub}</div>}
      </div>
    </div>
  );
}
