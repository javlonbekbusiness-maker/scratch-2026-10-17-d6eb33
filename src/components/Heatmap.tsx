/** GitHub-style 12-week activity grid (columns = weeks). */
export function Heatmap({ days, less, more }: { days: { day: string; count: number }[]; less: string; more: string }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const level = (c: number) => (c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4)));
  const colors = ['bg-slate-200 dark:bg-slate-800', 'bg-mint-200 dark:bg-mint-900', 'bg-mint-300 dark:bg-mint-700', 'bg-mint-500', 'bg-mint-700 dark:bg-mint-400'];
  const weeks: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1" role="img" aria-label={`${days.reduce((s, d) => s + d.count, 0)} answers in 12 weeks`}>
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-1">
            {w.map((d) => (
              <div key={d.day} title={`${d.day}: ${d.count}`} className={`h-3.5 w-3.5 rounded-[4px] sm:h-4 sm:w-4 ${colors[level(d.count)]}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] muted">
        {less}
        {colors.map((c) => <span key={c} className={`h-3 w-3 rounded-[3px] ${c}`} />)}
        {more}
      </div>
    </div>
  );
}
