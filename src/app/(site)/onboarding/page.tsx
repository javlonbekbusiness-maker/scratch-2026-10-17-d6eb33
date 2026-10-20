import type { Metadata } from 'next';
import { requireUser } from '@/lib/session';
import { getT } from '@/i18n/server';
import { OnboardingForm } from './OnboardingForm';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.onboardTitle'), robots: { index: false } };
}

export default async function OnboardingPage() {
  const user = await requireUser({ allowNotOnboarded: true });
  const { t } = await getT();
  return (
    <div className="container-app grid min-h-[70vh] place-items-center py-10">
      <div className="card w-full max-w-lg motion-safe:animate-fade-up p-6 sm:p-8">
        <h1 className="text-h1">{t('auth.onboardTitle')}</h1>
        <p className="mb-6 mt-1 text-muted">{t('auth.onboardSubtitle')}</p>
        <OnboardingForm defaults={{ name: user.name ?? '', email: user.email ?? '' }} />
      </div>
    </div>
  );
}
