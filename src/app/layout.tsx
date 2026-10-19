import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { getT } from '@/i18n/server';
import { I18nProvider } from '@/i18n/client';
import { ServiceWorker } from '@/components/ServiceWorker';
import { ThemeSync } from '@/components/ThemeSync';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    metadataBase: new URL(appUrl),
    title: { default: `${t('common.appName')} — ${t('landing.heroTitle')}`, template: `%s · ${t('common.appName')}` },
    description: t('landing.heroSubtitle'),
    manifest: '/manifest.webmanifest',
    icons: { icon: '/icons/icon.svg', apple: '/icons/icon.svg' },
    openGraph: { type: 'website', siteName: t('common.appName'), title: t('landing.heroTitle'), description: t('landing.heroSubtitle') },
    alternates: { languages: { uz: '/', ru: '/' } },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0a1020' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1020' },
  ],
  width: 'device-width',
  initialScale: 1,
};

// Dark is the default; only an explicit "light" choice skips it. Runs before first paint, so no flash.
// React never renders the <html> class, so it can't overwrite the theme on re-render.
const themeScript = `try{if(localStorage.getItem('theme')!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`;

const sans = Inter({ subsets: ['latin', 'latin-ext', 'cyrillic'], variable: '--font-sans', display: 'swap' });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict } = await getT();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${sans.variable} min-h-screen font-sans`}>
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
        <ServiceWorker />
        <ThemeSync />
      </body>
    </html>
  );
}
