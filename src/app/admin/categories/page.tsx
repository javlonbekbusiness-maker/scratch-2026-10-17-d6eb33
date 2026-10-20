import { requireAdmin } from '@/lib/session';
import { db } from '@/lib/db';
import { deleteCategory, saveCategory } from '../actions';
import { Badge, PageHeader, inputSm } from '../ui';
import { ConfirmButton } from '../ConfirmButton';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, [string, boolean]> = {
  'cat-created': ['Category created.', true],
  'cat-saved': ['Category saved.', true],
  'cat-deleted': ['Category deleted.', true],
  'cat-code': ['Code must be 1–4 letters or digits (e.g. B, BE, C1).', false],
  'cat-name': ['Uzbek and Russian names are required (max 60 characters).', false],
  'cat-exists': ['A category with this code already exists.', false],
  'cat-in-use': ['This category still has questions or users; deactivate it instead.', false],
  'bad-order': ['Order must be a whole number.', false],
};

export default async function CategoriesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const cats = await db.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { questions: true, users: true, tickets: true } } } });
  const msg = sp.msg ? MESSAGES[sp.msg] : undefined;

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide muted">{label}</span>
      {children}
    </label>
  );
  const catFields = (c?: (typeof cats)[number]) => (
    <>
      <F label="Code"><input name="code" required maxLength={4} defaultValue={c?.code} placeholder="C1" className={`${inputSm} font-mono uppercase`} /></F>
      <F label="Name — O'zbek"><input name="nameUz" required maxLength={60} defaultValue={c?.nameUz} className={inputSm} /></F>
      <F label="Name — Русский"><input name="nameRu" required maxLength={60} defaultValue={c?.nameRu} className={inputSm} /></F>
      <F label="Description — O'zbek"><input name="descUz" defaultValue={c?.descUz} className={inputSm} /></F>
      <F label="Description — Русский"><input name="descRu" defaultValue={c?.descRu} className={inputSm} /></F>
      <F label="Order"><input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className={inputSm} /></F>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} className="h-4 w-4" /> Active</label>
    </>
  );

  return (
    <>
      <PageHeader title="Licence categories" desc="Optional metadata on questions (users are never asked for a category)." />
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${msg[1] ? 'bg-mint-500/10 text-mint-700' : 'bg-red-500/10 text-red-700'}`}>{msg[0]}</p>}

      <h2 className="mb-3 text-lg font-bold">Licence categories</h2>
      <div className="space-y-2">
        {cats.map((c) => (
          <div key={c.id} className="card p-3">
            <form action={saveCategory} className="grid items-center gap-2 sm:grid-cols-4 xl:grid-cols-8">
              <input type="hidden" name="id" value={c.id} />
              {catFields(c)}
              <div className="flex flex-wrap items-center gap-2 sm:col-span-4 xl:col-span-8">
                <span className="text-xs muted">{c._count.questions} questions · {c._count.tickets} tickets · {c._count.users} users</span>
                {!c.isActive && <Badge>inactive</Badge>}
                <button className="btn-primary btn-sm ml-auto">Save</button>
              </div>
            </form>
            {!c._count.questions && !c._count.users && (
              <form action={deleteCategory} className="mt-1 text-right">
                <input type="hidden" name="id" value={c.id} />
                <ConfirmButton message={`Delete category ${c.code}?`} className="btn-ghost btn-sm text-red-600">Delete</ConfirmButton>
              </form>
            )}
          </div>
        ))}
        <form action={saveCategory} className="card grid items-center gap-2 border-dashed p-3 sm:grid-cols-4 xl:grid-cols-8">
          {catFields()}
          <button className="btn-secondary btn-sm sm:col-span-4 xl:col-span-8">+ Add category</button>
        </form>
      </div>

      <p className="mt-8 text-sm muted">Topics and topic groups are managed in <a href="/admin/topics" className="text-brand-600 underline">Admin → Topics</a>.</p>
    </>
  );
}
