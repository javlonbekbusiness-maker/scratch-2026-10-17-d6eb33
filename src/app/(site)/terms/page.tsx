import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { LegalPage } from '@/components/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('legal.termsTitle') };
}

export default async function Terms() {
  const { t } = await getT();
  return <LegalPage title={t('legal.termsTitle')} body={t('legal.termsBody')} draft={t('legal.draft')} />;
}
