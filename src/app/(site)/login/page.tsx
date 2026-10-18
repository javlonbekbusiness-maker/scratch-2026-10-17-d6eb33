import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getT } from '@/i18n/server';
import { LoginFlow } from './LoginFlow';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('common.login'), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ step?: string; next?: string }> }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const safeNext = sp.next?.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/dashboard';
  if (user) redirect(user.onboarded ? safeNext : '/onboarding');
  return (
    <div className="container-app grid min-h-[70vh] place-items-center py-10">
      <div className="card w-full max-w-md animate-fade-up p-6 sm:p-8">
        <LoginFlow step={sp.step === 'otp' ? 'otp' : sp.step === 'email' ? 'email' : 'phone'} />
      </div>
    </div>
  );
}
