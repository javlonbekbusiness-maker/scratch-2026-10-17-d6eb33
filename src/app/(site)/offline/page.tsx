import { getT } from '@/i18n/server';

export default async function Offline() {
  const { t } = await getT();
  return (
    <div className="container-app grid min-h-[60vh] place-items-center py-10 text-center">
      <div>
        <div className="text-6xl" aria-hidden>📡</div>
        <h1 className="mt-4 text-2xl font-bold">{t('offline.title')}</h1>
        <p className="mt-2 max-w-sm muted">{t('offline.text')}</p>
      </div>
    </div>
  );
}
