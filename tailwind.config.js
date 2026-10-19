/** @type {import('tailwindcss').Config} */
// Colours come from CSS variables (src/app/globals.css, values in src/styles/tokens.ts),
// so one class works in both themes: bg-surface, text-muted, border-line, …
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        raised: v('raised'),
        line: v('line'),
        ink: v('ink'),
        muted: v('muted'),
        'brand-fg': v('brand-fg'),
        'accent-fg': v('accent-fg'),
        success: v('success'),
        danger: v('danger'),
        warning: v('warning'),
        accent: { DEFAULT: '#3acc95', on: '#052e1f' },
        brand: {
          50: '#eef4ff', 100: '#dae6ff', 200: '#bcd1ff', 300: '#8eb2ff', 400: '#5d8bfb',
          500: '#3a6ff2', 600: '#1f5beb', 700: '#1a48d0', 800: '#1c3ca8', 900: '#1c3884', 950: '#152350',
        },
        mint: {
          50: '#edfcf5', 100: '#d3f8e5', 200: '#aaf0d0', 300: '#73e2b5', 400: '#3acc95', 500: '#16b27d',
          600: '#0a9066', 700: '#077a55', 800: '#0a5b44', 900: '#0a4b39',
        },
        // The old orange call-to-action colour is retired; "cta" now means the amber warning family
        // (promo countdowns, limits). Primary actions use brand blue.
        cta: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
        // Neutrals retuned to the navy palette so every page shares one surface system.
        slate: {
          50: '#f3f5fa', 100: '#e9edf5', 200: '#dce2ee', 300: '#c3ccdd', 400: '#9aa6c2', 500: '#5e6a86',
          600: '#4f5a74', 700: '#26314f', 800: '#1a2440', 900: '#121a2e', 950: '#0a1020',
        },
      },
      borderRadius: {
        card: '24px',
        tile: '20px',
        control: '16px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        micro: ['11px', { lineHeight: '14px', letterSpacing: '0.06em' }],
        small: ['13px', { lineHeight: '18px' }],
        body: ['15px', { lineHeight: '22px' }],
        title: ['16px', { lineHeight: '22px', fontWeight: '600' }],
        h2: ['20px', { lineHeight: '26px', fontWeight: '700' }],
        h1: ['24px', { lineHeight: '30px', fontWeight: '800' }],
        display: ['32px', { lineHeight: '38px', fontWeight: '800' }],
      },
      boxShadow: {
        card: '0 1px 2px rgb(14 23 48 / .06), 0 8px 24px rgb(14 23 48 / .06)',
        raised: '0 12px 40px rgb(5 10 25 / .35)',
        glow: '0 10px 30px -10px rgb(31 91 235 / .6)',
      },
      spacing: {
        tabbar: 'calc(4rem + env(safe-area-inset-bottom))',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(.96)' }, '60%': { transform: 'scale(1.02)' }, '100%': { transform: 'scale(1)' } },
        shake: { '0%,100%': { transform: 'none' }, '25%': { transform: 'translateX(-4px)' }, '75%': { transform: 'translateX(4px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'sheet-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up .25s ease-out both',
        pop: 'pop .25s ease-out',
        shake: 'shake .3s ease-in-out',
        shimmer: 'shimmer 1.6s linear infinite',
        'sheet-up': 'sheet-up .22s ease-out both',
      },
    },
  },
  plugins: [],
};
