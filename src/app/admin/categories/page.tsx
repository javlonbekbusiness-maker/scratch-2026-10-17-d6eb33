import { requireAdmin } from '@/lib/session';
import { db } from '@/lib/db';
import { deleteCategory, deleteTopic, saveCategory, saveTopic } from '../actions';
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
  'topic-created': ['Topic created.', true],
  'topic-saved': ['Topic saved.', true],
  'topic-deleted': ['Topic deleted.', true],
  'topic-name': ['Uzbek and Russian names are required (max 60 characters).', false],
  'topic-slug': ['Slug: 2–31 lowercase letters, digits or hyphens.', false],
  'topic-exists': ['A topic with this slug already exists.', false],
  'topic-in-use': ['This topic still has questions; move them to another topic first.', false],
  'topic-in-mix': ['An exam template topic mix uses this topic; edit the template first.', false],
  'bad-order': ['Order must be a whole number.', false],
};

export default async function CategoriesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [cats, topics, topicCounts] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { questions: true, users: true, tickets: true } } } }),
    db.topic.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.question.groupBy({ by: ['topicId'], _count: true }),
  ]);
  const qByTopic = new Map(topicCounts.map((r) => [r.topicId, r._count]));
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
      <F label="Name — Кирилл"><input name="nameCy" maxLength={60} defaultValue={c?.nameCy} placeholder="auto from Uzbek" className={inputSm} /></F>
      <F label="Name — Русский"><input name="nameRu" required maxLength={60} defaultValue={c?.nameRu} className={inputSm} /></F>
      <F label="Description — O'zbek"><input name="descUz" defaultValue={c?.descUz} className={inputSm} /></F>
      <F label="Description — Русский"><input name="descRu" defaultValue={c?.descRu} className={inputSm} /></F>
      <F label="Order"><input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className={inputSm} /></F>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} className="h-4 w-4" /> Active</label>
    </>
  );

  return (
    <>
      <PageHeader title="Categories & topics" desc="Inactive categories are hidden from sign-up and the category switcher. Topic slugs are fixed once created (templates and imports refer to them)." />
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${msg[1] ? 'bg-mint-500/10 text-mint-700' : 'bg-red-500/10 text-red-700'}`}>{msg[0]}</p>}

      <h2 className="mb-3 text-lg font-bold">Licence categories</h2>
      <div className="space-y-2">
        {cats.map((c) => (
          <div key={c.id} className="card p-3">
            <form action={saveCategory} className="grid items-center gap-2 sm:grid-cols-4 xl:grid-cols-8">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="nameUzPrev" value={c.nameUz} />
              <input type="hidden" name="descUzPrev" value={c.descUz} />
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

      <h2 className="mb-1 mt-8 text-lg font-bold">Topics</h2>
      <p className="mb-3 text-xs muted">Columns: slug · icon · name (O&apos;zbek) · name (Кирилл) · name (Русский) · order</p>
      <div className="space-y-2">
        {topics.map((t) => (
          <div key={t.id} className="card flex flex-wrap items-center gap-2 p-3">
            <form action={saveTopic} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="nameUzPrev" value={t.nameUz} />
              <span className="w-28 font-mono text-xs">{t.slug}</span>
              <input name="icon" defaultValue={t.icon} maxLength={8} className={`${inputSm} w-16 text-center`} aria-label="Icon" />
              <input name="nameUz" required defaultValue={t.nameUz} className={`${inputSm} w-48`} aria-label="Name Uzbek" />
              <input name="nameCy" defaultValue={t.nameCy} className={`${inputSm} w-48`} aria-label="Name Cyrillic" />
              <input name="nameRu" required defaultValue={t.nameRu} className={`${inputSm} w-48`} aria-label="Name Russian" />
              <input name="sortOrder" type="number" defaultValue={t.sortOrder} className={`${inputSm} w-20`} aria-label="Order" />
              <span className="text-xs muted">{qByTopic.get(t.id) ?? 0} questions</span>
              <button className="btn-primary btn-sm">Save</button>
            </form>
            {!qByTopic.get(t.id) && (
              <form action={deleteTopic}>
                <input type="hidden" name="id" value={t.id} />
                <ConfirmButton message={`Delete topic ${t.slug}?`} className="btn-ghost btn-sm text-red-600">Delete</ConfirmButton>
              </form>
            )}
          </div>
        ))}
        <form action={saveTopic} className="card flex flex-wrap items-center gap-2 border-dashed p-3">
          <input name="slug" required placeholder="slug (e.g. railway)" className={`${inputSm} w-40 font-mono`} aria-label="Slug" />
          <input name="icon" placeholder="🚆" maxLength={8} className={`${inputSm} w-16 text-center`} aria-label="Icon" />
          <input name="nameUz" required placeholder="Name (uz)" className={`${inputSm} w-48`} aria-label="Name Uzbek" />
          <input name="nameRu" required placeholder="Name (ru)" className={`${inputSm} w-48`} aria-label="Name Russian" />
          <button className="btn-secondary btn-sm">+ Add topic</button>
        </form>
      </div>
    </>
  );
}
