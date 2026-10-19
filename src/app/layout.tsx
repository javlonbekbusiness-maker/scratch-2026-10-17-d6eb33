import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getT } from '@/i18n/server';
import { I18nProvider } from '@/i18n/client';
import { ServiceWorker } from '@/components/ServiceWorker';

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
    { media: '(prefers-color-scheme: light)', color: '#1f5beb' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
  width: 'device-width',
  initialScale: 1,
};

const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict } = await getT();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
