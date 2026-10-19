import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { getCurrentUser } from '@/lib/session';
import { Logo } from '@/components/Logo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('notFound.title'), robots: { index: false } };
}

/** Shown for unknown URLs and for pages a visitor isn't allowed to see (e.g. /admin for non-admins). */
export default async function NotFound() {
  const [{ t }, user] = await Promise.all([getT(), getCurrentUser()]);
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="flex justify-center"><Logo /></div>
        <p className="mt-8 text-6xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">404</p>
        <h1 className="mt-3 text-xl font-bold">{t('notFound.title')}</h1>
        <p className="mt-2 muted">{t('notFound.text')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={user ? '/dashboard' : '/'} className="btn-primary">{user ? t('nav.dashboard') : t('notFound.home')}</Link>
          <Link href="/library" className="btn-ghost">{t('nav.library')}</Link>
        </div>
      </div>
    </main>
  );
}
