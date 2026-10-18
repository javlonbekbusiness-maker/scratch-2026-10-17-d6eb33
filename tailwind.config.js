/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff', 100: '#d9eaff', 200: '#bcdaff', 300: '#8ec2ff', 400: '#599fff',
          500: '#3479f6', 600: '#1f5beb', 700: '#1a48d0', 800: '#1c3ca8', 900: '#1c3884', 950: '#152350',
        },
        mint: {
          50: '#edfcf5', 100: '#d3f8e5', 200: '#aaf0d0', 300: '#73e2b5', 400: '#3acc95', 500: '#16b27d',
          600: '#0a9066', 700: '#087354', 800: '#0a5b44', 900: '#0a4b39',
        },
        cta: { 400: '#ffa94d', 500: '#ff8a1f', 600: '#f06f0a', 700: '#c75408' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(.96)' }, '60%': { transform: 'scale(1.02)' }, '100%': { transform: 'scale(1)' } },
        shake: { '0%,100%': { transform: 'none' }, '25%': { transform: 'translateX(-4px)' }, '75%': { transform: 'translateX(4px)' } },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        pop: 'pop .3s ease-out',
        shake: 'shake .3s ease-in-out',
      },
    },
  },
  plugins: [],
};
