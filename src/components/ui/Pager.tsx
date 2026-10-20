import Link from 'next/link';
import { Icon } from './Icon';

/** Server-rendered page links (prev / "page x of y" / next) that keep the other query params. */
export function Pager({
  page,
  pages,
  href,
  labels,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  labels: { prev: string; next: string; pageOf: string; nav: string };
}) {
  if (pages <= 1) return null;
  const btn = 'btn-secondary min-h-12 gap-1 px-4';
  const off = `${btn} pointer-events-none opacity-40`;
  return (
    <nav aria-label={labels.nav} className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={btn} rel="prev"><Icon name="chevronLeft" size={18} /> {labels.prev}</Link>
      ) : (
        <span className={off} aria-disabled="true"><Icon name="chevronLeft" size={18} /> {labels.prev}</span>
      )}
      <span className="text-small text-muted" aria-current="page">{labels.pageOf}</span>
      {page < pages ? (
        <Link href={href(page + 1)} className={btn} rel="next">{labels.next} <Icon name="chevronRight" size={18} /></Link>
      ) : (
        <span className={off} aria-disabled="true">{labels.next} <Icon name="chevronRight" size={18} /></span>
      )}
    </nav>
  );
}

/** Parses ?page= into a 1-based page clamped to [1, pages]. */
export function pageParam(raw: string | undefined, total: number, size: number) {
  const pages = Math.max(1, Math.ceil(total / size));
  const n = Number.parseInt(raw ?? '1', 10);
  const page = Number.isFinite(n) ? Math.min(Math.max(1, n), pages) : 1;
  return { page, pages, skip: (page - 1) * size };
}
