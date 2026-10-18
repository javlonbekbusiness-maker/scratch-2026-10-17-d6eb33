import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { LegalPage } from '@/components/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('legal.privacyTitle') };
}

export default async function Privacy() {
  const { t } = await getT();
  return <LegalPage title={t('legal.privacyTitle')} body={t('legal.privacyBody')} draft={t('legal.draft')} />;
}
