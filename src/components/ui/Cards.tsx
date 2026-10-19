import Link from 'next/link';
import { Icon, type IconName } from './Icon';

export type Tone = 'brand' | 'accent' | 'warning' | 'danger' | 'violet';

/** Icon tile colours per tone (tinted tile, coloured glyph); readable in both themes. */
const TILE: Record<Tone, string> = {
  brand: 'bg-brand-600/10 text-brand-fg dark:bg-brand-500/15',
  accent: 'bg-accent/15 text-accent-fg',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/10 text-danger',
  violet: 'bg-violet-500/10 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300',
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
  ...target
}: { icon: IconName; title: string; subtitle?: string; badge?: string | number | null; tone?: Tone } & CardTarget) {
  return (
    <Frame target={target as CardTarget} className="min-h-[132px] flex-col items-start gap-3 p-4 sm:p-5">
      <IconTile icon={icon} tone={tone} />
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
