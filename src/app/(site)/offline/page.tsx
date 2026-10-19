import { getT } from '@/i18n/server';
import { EmptyState } from '@/components/ui/Primitives';

export default async function Offline() {
  const { t } = await getT();
  return (
    <div className="container-app grid min-h-[60vh] place-items-center py-10">
      <div className="card w-full max-w-md">
        <EmptyState icon="globe" title={t('offline.title')} text={t('offline.text')} />
      </div>
    </div>
  );
}
