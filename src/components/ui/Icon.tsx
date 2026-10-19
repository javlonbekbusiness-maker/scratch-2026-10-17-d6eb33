/**
 * Our inline icon set: 24×24, 2px round strokes, currentColor. No icon font, no network request.
 * Add a shape here rather than pasting SVGs into pages.
 */
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  bookmark: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5l1.6 1.2-2 3.5-1.9-.7a7.6 7.6 0 0 1-1.9 1.1L15 20.5h-4l-.3-1.9a7.6 7.6 0 0 1-1.9-1.1l-1.9.7-2-3.5 1.6-1.2a7.5 7.5 0 0 1 0-2.2L4.9 10.1l2-3.5 1.9.7a7.6 7.6 0 0 1 1.9-1.1L11 4.3h4l.3 1.9a7.6 7.6 0 0 1 1.9 1.1l1.9-.7 2 3.5-1.6 1.2a7.5 7.5 0 0 1 0 2.2z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 8.5-3 8.5h18S18 15 18 8zM10.3 20a2 2 0 0 0 3.4 0',
  flame: 'M12 22c4 0 7-2.7 7-6.8 0-3.6-2.6-6.3-4.4-8.2-.5 2-1.6 3.4-3 4C12 7.6 10.4 4.5 8 2c.3 3.4-3 6.4-3 10.9C5 19 8 22 12 22z',
  ticket: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5zM9 9h6M9 12h6M9 15h3',
  layers: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5',
  trap: 'M12 3 2 20h20zM12 10v4.5M12 17.5h.01',
  timer: 'M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  signpost: 'M12 3v18M5 6h11l3 2.5L16 11H5zM19 13H8l-3 2.5L8 18h11z',
  mistakes: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 9l6 6M15 9l-6 6',
  trophy: 'M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6v4H9z',
  duel: 'M14.5 4H20v5.5L9.5 20 4 14.5zM4 20l3-3M13 7l4 4M7 9.5 9.5 12',
  play: 'M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.7l-12-7.6A1 1 0 0 0 7 4.5z',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  check: 'M4 12.5 9.5 18 20 6.5',
  close: 'M6 6l12 12M18 6 6 18',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21a8 8 0 0 1 16 0',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7.5a4 4 0 0 1 8 0V11',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21a2 2 0 0 1 2-2h13v2z',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  card: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6zM9 12l2 2 4-4',
  gift: 'M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9C10 5 6.5 5 6.5 7.2 6.5 9 12 9 12 9zM12 9c2-4 5.5-4 5.5-1.8C17.5 9 12 9 12 9z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  note: 'M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, className = '', label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
