import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-extrabold tracking-tight" aria-label="YHQ Test">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-brand-600" />
        <path d="M9 22 L16 9 L23 22" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="19" r="2.4" className="fill-mint-400" />
      </svg>
      <span className="text-lg">
        YHQ<span className="text-brand-600 dark:text-brand-400"> Test</span>
      </span>
    </Link>
  );
}
