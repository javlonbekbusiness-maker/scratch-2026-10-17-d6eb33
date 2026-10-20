import Link from 'next/link';
import { Icon, type IconName } from './Icon';

export const TONES = ['brand', 'accent', 'warning', 'danger', 'violet', 'sky', 'slate'] as const;
export type Tone = (typeof TONES)[number];
export const toTone = (v: string | null | undefined): Tone => ((TONES as readonly string[]).includes(v ?? '') ? (v as Tone) : 'brand');

/** Icon tile colours per tone (tinted tile, coloured glyph); readable in both themes. */
const TILE: Record<Tone, string> = {
  brand: 'bg-brand-600/10 text-brand-fg dark:bg-brand-500/15',
  accent: 'bg-accent/15 text-accent-fg',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/10 text-danger',
  violet: 'bg-violet-500/10 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300',
  sky: 'bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  slate: 'bg-slate-500/10 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300',
};

export function IconTile({ icon, tone = 'brand', size = 'md' }: { icon: IconName; tone?: Tone; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-2xl';
  return (
    <span className={`grid shrink-0 place-items-center ${box} ${TILE[tone]}`} aria-hidden>
      <Icon name={icon} size={size === 'sm' ? 20 : 24} />
    </span>
  );
}

type CardTarget =
  | { href: string; submit?: never; soon?: never }
  | { submit: true; href?: never; soon?: never } // inside a <form>: renders a submit button
  | { soon: string; href?: never; submit?: never }; // not available yet: shown, not clickable

const cardBase =
  'card group relative flex h-full w-full text-left outline-none transition duration-150 hover:border-brand-500/40 focus-visible:ring-2 focus-visible:ring-brand-500';

function Frame({ target, className, children, label }: { target: CardTarget; className: string; children: React.ReactNode; label?: string }) {
  if ('soon' in target && target.soon) {
    return (
      <div className={`${cardBase} ${className} cursor-default opacity-70 hover:border-line`} aria-disabled="true">
        {children}
      </div>
    );
  }
  if ('submit' in target && target.submit) {
    return (
      <button type="submit" className={`${cardBase} pressable ${className}`} aria-label={label}>
        {children}
      </button>
    );
  }
  return (
    <Link href={(target as { href: string }).href} className={`${cardBase} pressable ${className}`} aria-label={label}>
      {children}
    </Link>
  );
}

/** Square-ish card: icon tile on top, title and optional subtitle below, optional badge in the corner. */
export function ActionCard({
  icon,
  title,
  subtitle,
  badge,
  tone = 'brand',
  locked,
  lockedLabel,
  ...target
}: { icon: IconName; title: string; subtitle?: string; badge?: string | number | null; tone?: Tone; locked?: boolean; lockedLabel?: string } & CardTarget) {
  return (
    <Frame target={target as CardTarget} className="min-h-[132px] flex-col items-start gap-3 p-4 sm:p-5" label={locked && lockedLabel ? `${title} — ${lockedLabel}` : undefined}>
      <IconTile icon={icon} tone={tone} />
      {locked && (
        <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-raised text-muted" aria-hidden>
          <Icon name="lock" size={16} />
        </span>
      )}
      <span className="mt-auto block">
        <span className="block text-title leading-snug text-ink">{title}</span>
        {subtitle && <span className="mt-0.5 block text-small text-muted">{subtitle}</span>}
      </span>
      {badge !== undefined && badge !== null && badge !== 0 && badge !== '' && (
        <span className="num absolute right-3 top-3 min-w-[24px] rounded-full bg-danger px-2 py-0.5 text-center text-xs font-bold text-white dark:text-canvas">
          {badge}
        </span>
      )}
      {'soon' in target && target.soon && (
        <span className="absolute right-3 top-3 rounded-full bg-raised px-2 py-0.5 text-micro font-semibold uppercase text-muted">{target.soon}</span>
      )}
    </Frame>
  );
}

/** Card for a ticket or topic: big label, progress toward mastery, accuracy, optional demo/lock badge. */
export function ProgressCard({
  lead,
  title,
  subtitle,
  progress,
  progressLabel,
  accuracy,
  accuracyLabel,
  badge,
  locked,
  lockedLabel,
  ...target
}: {
  lead: React.ReactNode;
  title: string;
  subtitle?: string;
  progress: { value: number; max: number };
  progressLabel: string;
  accuracy: number | null;
  accuracyLabel: string;
  badge?: string;
  locked?: boolean;
  lockedLabel?: string;
} & CardTarget) {
  const pct = progress.max ? Math.round((100 * progress.value) / progress.max) : 0;
  return (
    <Frame target={target as CardTarget} className="flex-col gap-3 p-4" label={locked && lockedLabel ? `${title} — ${lockedLabel}` : undefined}>
      <span className="flex items-start justify-between gap-2">
        <span className="grid h-12 min-w-[48px] place-items-center rounded-2xl bg-raised px-2 text-h2 text-ink" aria-hidden>{lead}</span>
        {locked ? (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-raised text-muted"><Icon name="lock" size={16} /></span>
        ) : badge ? (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-micro font-semibold uppercase text-accent-fg">{badge}</span>
        ) : null}
      </span>
      <span className="block min-w-0">
        <span className="block truncate text-title text-ink">{title}</span>
        {subtitle && <span className="block text-small text-muted">{subtitle}</span>}
      </span>
      <span className="mt-auto block w-full">
        <span className="mb-1.5 flex justify-between text-small">
          <span className="text-muted">{progressLabel}</span>
          <span className="num font-semibold text-ink">{progress.value}/{progress.max}</span>
        </span>
        <span className="block h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label={`${title}: ${progressLabel}`} aria-valuemin={0} aria-valuemax={progress.max} aria-valuenow={progress.value}>
          <span className="block h-full rounded-full bg-brand-600 transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </span>
        <span className="mt-2 block text-small text-muted">
          {accuracyLabel}: <span className={`num font-semibold ${accuracy === null ? '' : accuracy >= 85 ? 'text-accent-fg' : accuracy >= 60 ? 'text-ink' : 'text-warning'}`}>{accuracy === null ? '—' : `${accuracy}%`}</span>
        </span>
      </span>
    </Frame>
  );
}

/** Full-width row card: icon left, text, trailing slot (chevron by default). */
export function WideCard({
  icon,
  title,
  subtitle,
  trailing,
  tone = 'brand',
  ...target
}: { icon: IconName; title: string; subtitle?: string; trailing?: React.ReactNode; tone?: Tone } & CardTarget) {
  const soon = 'soon' in target && target.soon;
  return (
    <Frame target={target as CardTarget} className="min-h-[72px] items-center gap-3 px-4 py-3">
      <IconTile icon={icon} tone={tone} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-title text-ink">{title}</span>
        {subtitle && <span className="block truncate text-small text-muted">{subtitle}</span>}
      </span>
      {soon ? (
        <span className="rounded-full bg-raised px-2 py-0.5 text-micro font-semibold uppercase text-muted">{soon}</span>
      ) : (
        trailing ?? <Icon name="chevronRight" size={20} className="text-muted transition group-hover:translate-x-0.5" />
      )}
    </Frame>
  );
}
