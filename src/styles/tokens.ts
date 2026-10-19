/**
 * Design tokens — the single source of truth for colours.
 * globals.css exposes them as CSS variables (light on :root, dark on .dark) and
 * tailwind.config.js maps them to utilities (bg-surface, text-muted, border-line, …).
 * A unit test checks the WCAG AA contrast of the text pairs below.
 */
export const THEMES = {
  dark: {
    canvas: '#0A1020', // page background
    surface: '#121A2E', // cards
    raised: '#1A2440', // icon tiles, inputs, sheets
    line: '#26314F', // borders
    ink: '#EEF2FA', // text
    muted: '#9AA6C2', // secondary text
    brandFg: '#7EA6FF', // brand-coloured text
    accentFg: '#5FE0AE', // green text
    success: '#3ACC95',
    danger: '#F87171',
    warning: '#FBBF24',
  },
  light: {
    canvas: '#F3F5FA',
    surface: '#FFFFFF',
    raised: '#F7F9FD',
    line: '#E2E7F1',
    ink: '#0E1730',
    muted: '#5E6A86',
    brandFg: '#1A48D0',
    accentFg: '#077A55',
    success: '#0A8F62',
    danger: '#C4261A',
    warning: '#B45309',
  },
} as const;

export const BRAND = '#1F5BEB';
export const ACCENT = '#3ACC95';
export const ON_ACCENT = '#052E1F';

export type ThemeName = keyof typeof THEMES;

/** WCAG relative-luminance contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
