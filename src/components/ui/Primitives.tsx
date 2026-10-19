import Link from 'next/link';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
};

export function buttonClass(variant: Variant = 'primary', size: 'md' | 'sm' = 'md', extra = '') {
  return `${VARIANT[variant]} ${size === 'sm' ? 'btn-sm' : ''} ${extra}`.trim();
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: { variant?: Variant; size?: 'md' | 'sm'; icon?: IconName } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
}: { href: string; variant?: Variant; size?: 'md' | 'sm'; icon?: IconName; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
      {children}
    </Link>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'brand' | 'success' | 'danger' | 'warning' }) {
  const cls = {
    neutral: 'bg-raised text-muted',
    brand: 'bg-brand-600/10 text-brand-fg',
    success: 'bg-success/15 text-accent-fg',
    danger: 'bg-danger/10 text-danger',
    warning: 'bg-warning/15 text-warning',
  }[tone];
  return <span className={`chip ${cls}`}>{children}</span>;
}

/** Compact pill with an icon and a number, e.g. streak or accuracy. */
export function StatChip({ icon, value, label, tone = 'neutral' }: { icon: IconName; value: string | number; label: string; tone?: 'neutral' | 'warning' | 'success' | 'brand' }) {
  const glyph = { neutral: 'text-muted', warning: 'text-warning', success: 'text-accent-fg', brand: 'text-brand-fg' }[tone];
  return (
    <span className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-bold text-ink" title={label}>
      <Icon name={icon} size={18} className={glyph} />
      <span className="num">{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  label,
  className = '',
  onBrand = false,
}: { value: number; max?: number; tone?: 'brand' | 'accent' | 'warning' | 'danger'; label: string; className?: string; onBrand?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = { brand: 'bg-brand-600', accent: 'bg-accent', warning: 'bg-warning', danger: 'bg-danger' }[tone];
  return (
    <div
      className={`h-2 overflow-hidden rounded-full ${onBrand ? 'bg-white/20' : 'bg-raised'} ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
    >
      <div className={`h-full rounded-full ${fill} transition-[width] duration-700 ease-out`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SectionHeader({ title, action, id }: { title: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-h2 text-ink">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-raised text-muted" aria-hidden>
        <Icon name={icon} size={28} />
      </span>
      <p className="mt-4 text-title text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-small text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Placeholder block with fixed size, so content can arrive without layout shift. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Labelled form field around the shared .input styles. */
export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-small text-muted">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-small font-medium text-danger">{error}</p>}
    </div>
  );
}

/** Settings-style row inside a card list. */
export function ListRow({ icon, title, subtitle, href, trailing }: { icon?: IconName; title: string; subtitle?: string; href?: string; trailing?: React.ReactNode }) {
  const inner = (
    <>
      {icon && <Icon name={icon} size={20} className="text-muted" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{title}</span>
        {subtitle && <span className="block truncate text-small text-muted">{subtitle}</span>}
      </span>
      {trailing ?? (href ? <Icon name="chevronRight" size={18} className="text-muted" /> : null)}
    </>
  );
  const cls = 'flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left';
  return href ? <Link href={href} className={`${cls} hover:bg-raised`}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
