import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { OnboardingForm } from './OnboardingForm';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('auth.onboardTitle'), robots: { index: false } };
}

export default async function OnboardingPage() {
  const user = await requireUser({ allowNotOnboarded: true });
  const { t, locale } = await getT();
  const cats = await db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  return (
    <div className="container-app grid min-h-[70vh] place-items-center py-10">
      <div className="card w-full max-w-lg animate-fade-up p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{t('auth.onboardTitle')}</h1>
        <p className="mb-6 mt-1 muted">{t('auth.onboardSubtitle')}</p>
        <OnboardingForm
          defaults={{ name: user.name ?? '', email: user.email ?? '', categoryId: user.categoryId ?? cats.find((c) => c.code === 'B')?.id ?? '' }}
          categories={cats.map((c) => ({ id: c.id, code: c.code, name: pick(c, 'name', locale), desc: pick(c, 'desc', locale) }))}
        />
      </div>
    </div>
  );
}
