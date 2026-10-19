import { requireAdmin } from '@/lib/session';
import { PageHeader } from '../ui';
import { ImportForm } from './ImportForm';

export default async function ImportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Bulk import" desc="Upload CSV (comma or semicolon) or JSON. Every row is validated and errors are shown before anything is saved." />
      {sp.done && (
        <p className="mb-4 rounded-xl bg-mint-500/10 px-3 py-2 text-sm text-mint-700">
          Imported {sp.done}: {sp.created} created, {sp.updated} updated.
        </p>
      )}
      {sp.expired && <p className="mb-4 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-800">Preview expired — upload the file again.</p>}
      <section className="card mb-6 p-5">
        <h2 className="font-bold">Templates</h2>
        <p className="mt-1 text-sm muted">
          Questions: one row per question; <code>correct</code> is the answer number (1–5). Text columns are Uzbek (<code>_uz</code>) and Russian (<code>_ru</code>); older files with <code>_cy</code> columns still import and those columns are ignored.
          Rows with an existing <code>external_id</code> are updated.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/api/admin/templates/questions.csv" className="btn-secondary btn-sm">questions.csv</a>
          <a href="/api/admin/templates/questions.json" className="btn-secondary btn-sm">questions.json</a>
          <a href="/api/admin/templates/promo.csv" className="btn-secondary btn-sm">promo-codes.csv</a>
          <a href="/api/admin/templates/users.csv" className="btn-secondary btn-sm">users.csv</a>
        </div>
      </section>
      <ImportForm />
    </>
  );
}
