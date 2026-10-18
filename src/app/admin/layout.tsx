import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/HeaderControls';
import { AdminNav } from './AdminNav';

export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="border-b border-slate-200 bg-white p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <Logo href="/admin" />
          <ThemeToggle />
        </div>
        <AdminNav />
        <div className="mt-6 hidden text-xs muted lg:block">
          Signed in as {admin.name ?? admin.phone}
          <br />
          <Link href="/dashboard" className="underline">← Back to app</Link>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
