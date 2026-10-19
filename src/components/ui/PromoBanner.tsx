import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { Icon } from './Icon';

/**
 * Discount banner for the home screen. Render it only when a real campaign is active for this
 * user (the caller decides); the countdown runs to the campaign end time set on the server.
 */
export function PromoBanner({ title, text, cta, endsLabel, endsAt }: { title: string; text: string; cta: string; endsLabel: string; endsAt: string }) {
  return (
    <Link
      href="/pricing"
      className="pressable group relative flex items-center gap-4 overflow-hidden rounded-card border border-warning/40 bg-gradient-to-r from-[#2b1d05] via-[#1c1a2e] to-surface p-4 text-[#fff7e6] sm:p-5 dark:from-[#2b1d05]"
    >
      <PromoArt />
      <span className="min-w-0 flex-1">
        <span className="block text-h2 text-[#fbbf24]">{title}</span>
        <span className="mt-0.5 block text-small text-[#f3e9d6]">{text}</span>
        <span className="mt-2 inline-flex items-center gap-2 text-small">
          <span className="text-[#f3e9d6]">{endsLabel}</span>
          <span className="num inline-block min-w-[8ch] rounded-lg bg-black/30 px-2 py-0.5 font-bold text-[#fbbf24]">
            <Countdown until={endsAt} />
          </span>
        </span>
      </span>
      <span className="hidden items-center gap-1 rounded-full bg-[#fbbf24] px-4 py-2 text-sm font-bold text-[#2b1d05] sm:inline-flex">
        {cta} <Icon name="arrowRight" size={16} />
      </span>
      <Icon name="chevronRight" className="text-[#fbbf24] sm:hidden" />
    </Link>
  );
}

/** Our own illustration: a road with a dashed centre line running into a discount tag. */
function PromoArt() {
  return (
    <svg viewBox="0 0 88 88" className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" aria-hidden>
      <rect x="2" y="2" width="84" height="84" rx="22" fill="#fbbf24" fillOpacity="0.12" />
      <path d="M14 78 C 30 52, 44 40, 60 30" stroke="#3a4766" strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d="M14 78 C 30 52, 44 40, 60 30" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="6 6" fill="none" strokeLinecap="round" />
      <g transform="rotate(-18 62 30)">
        <path d="M48 18h22a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H48l-8-12z" fill="#fbbf24" />
        <circle cx="47" cy="30" r="2.6" fill="#2b1d05" />
        <path d="M56 36l10-12M57 25.5h.01M65 34.5h.01" stroke="#2b1d05" strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}
