import { requireAdmin } from '@/lib/session';
import Link from 'next/link';
import { db } from '@/lib/db';
import { deleteLibraryItem, saveArticle, saveSign } from '../actions';
import { PageHeader } from '../ui';
import { ConfirmButton } from '../ConfirmButton';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, [string, boolean]> = {
  'sign-created': ['Sign added. It appears in the public library now.', true],
  'sign-saved': ['Sign saved.', true],
  'rule-created': ['Article added.', true],
  'rule-saved': ['Article saved.', true],
  deleted: ['Deleted.', true],
  'sign-code': ['Code (max 20) and group (max 80) are required.', false],
  'sign-name': ['Uzbek and Russian names are required (max 120 characters).', false],
  'sign-image': ['Give an image URL (https://… or /path) or upload a PNG, JPEG or WebP.', false],
  'bad-image': ['Image must be PNG, JPEG or WebP and under 2 MB.', false],
  'rule-number': ['Article number: up to 20 letters, digits, dots or hyphens (e.g. 10.4).', false],
  'rule-text': ['Title and text are required in Uzbek and Russian.', false],
  'rule-exists': ['An article with this number already exists.', false],
  'bad-order': ['Order must be a whole number.', false],
};

const inp = 'input min-h-[40px] rounded-xl px-3 text-sm';
const F = ({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) => (
  <label className={`block ${wide ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
    <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide muted">{label}</span>
    {children}
  </label>
);

export default async function LibraryAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = sp.tab === 'rules' ? 'rules' : 'signs';
  const [signs, rules] = await Promise.all([
    db.roadSign.findMany({ orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }] }),
    db.ruleArticle.findMany({ orderBy: { number: 'asc' } }),
  ]);
  const editSign = tab === 'signs' && sp.edit ? signs.find((s) => s.id === sp.edit) : undefined;
  const editRule = tab === 'rules' && sp.edit ? rules.find((r) => r.id === sp.edit) : undefined;
  const showForm = !!sp.edit;
  const msg = sp.msg ? MESSAGES[sp.msg] : undefined;
  const groups = [...new Set(signs.map((s) => s.group))];
  const placeholderRules = rules.filter((r) => r.bodyUz.startsWith('[NAMUNA]')).length;

  return (
    <>
      <PageHeader
        title="Signs & rules"
        desc="The public library (/library). Replace the sample content with the official traffic rules (YHQ) and sign catalogue."
        actions={<Link href={`/admin/library?tab=${tab}&edit=new#form`} className="btn-primary btn-sm">+ New {tab === 'signs' ? 'sign' : 'article'}</Link>}
      />
      {placeholderRules > 0 && <p className="mb-4 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{placeholderRules} rule articles still contain sample text ([NAMUNA]).</p>}
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${msg[1] ? 'bg-mint-500/10 text-mint-700' : 'bg-red-500/10 text-red-700'}`}>{msg[0]}</p>}

      <nav className="mb-4 flex gap-2" aria-label="Library section">
        <Link href="/admin/library?tab=signs" aria-current={tab === 'signs' ? 'page' : undefined} className={`btn btn-sm ${tab === 'signs' ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>Road signs ({signs.length})</Link>
        <Link href="/admin/library?tab=rules" aria-current={tab === 'rules' ? 'page' : undefined} className={`btn btn-sm ${tab === 'rules' ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>Rule articles ({rules.length})</Link>
      </nav>

      {showForm && tab === 'signs' && (
        <section id="form" className="card mb-6 scroll-mt-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editSign ? `Edit sign ${editSign.code}` : 'New sign'}</h2>
            <Link href="/admin/library?tab=signs" className="btn-ghost btn-sm">Close</Link>
          </div>
          <form action={saveSign} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {editSign && <input type="hidden" name="id" value={editSign.id} />}
            {editSign && <input type="hidden" name="nameUzPrev" value={editSign.nameUz} />}
            {editSign && <input type="hidden" name="descUzPrev" value={editSign.descUz} />}
            <F label="Code"><input name="code" required maxLength={20} defaultValue={editSign?.code} placeholder="2.5" className={inp} /></F>
            <F label="Group">
              <input name="group" required maxLength={80} defaultValue={editSign?.group} list="sign-groups" className={inp} />
              <datalist id="sign-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            </F>
            <F label="Order"><input name="sortOrder" type="number" defaultValue={editSign?.sortOrder ?? 0} className={inp} /></F>
            <F label="Name — O'zbek"><input name="nameUz" required maxLength={120} defaultValue={editSign?.nameUz} className={inp} /></F>
            <F label="Name — Кирилл"><input name="nameCy" maxLength={120} defaultValue={editSign?.nameCy} placeholder="auto from Uzbek" className={inp} /></F>
            <F label="Name — Русский"><input name="nameRu" required maxLength={120} defaultValue={editSign?.nameRu} className={inp} /></F>
            <F label="Description — O'zbek"><textarea name="descUz" rows={2} defaultValue={editSign?.descUz} className="input py-2 text-sm" /></F>
            <F label="Description — Кирилл"><textarea name="descCy" rows={2} defaultValue={editSign?.descCy} placeholder="auto from Uzbek" className="input py-2 text-sm" /></F>
            <F label="Description — Русский"><textarea name="descRu" rows={2} defaultValue={editSign?.descRu} className="input py-2 text-sm" /></F>
            <F label="Image URL"><input name="imageUrl" defaultValue={editSign?.imageUrl} placeholder="/signs/stop.svg or https://…" className={inp} /></F>
            <F label="…or upload (PNG/JPEG/WebP, ≤2 MB)"><input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" /></F>
            {editSign?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={editSign.imageUrl} alt="" className="h-20 w-20 object-contain" />
            )}
            <div className="sm:col-span-2 lg:col-span-3"><button className="btn-primary btn-sm">{editSign ? 'Save sign' : 'Add sign'}</button></div>
          </form>
        </section>
      )}

      {showForm && tab === 'rules' && (
        <section id="form" className="card mb-6 scroll-mt-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editRule ? `Edit article ${editRule.number}` : 'New article'}</h2>
            <Link href="/admin/library?tab=rules" className="btn-ghost btn-sm">Close</Link>
          </div>
          <form action={saveArticle} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {editRule && <input type="hidden" name="id" value={editRule.id} />}
            {editRule && <input type="hidden" name="titleUzPrev" value={editRule.titleUz} />}
            {editRule && <input type="hidden" name="bodyUzPrev" value={editRule.bodyUz} />}
            <F label="Article number"><input name="number" required maxLength={20} defaultValue={editRule?.number} placeholder="10.4" className={`${inp} font-mono`} /></F>
            <F label="Chapter"><input name="chapter" maxLength={120} defaultValue={editRule?.chapter} className={inp} /></F>
            <div className="hidden lg:block" />
            <F label="Title — O'zbek"><input name="titleUz" required defaultValue={editRule?.titleUz} className={inp} /></F>
            <F label="Title — Кирилл"><input name="titleCy" defaultValue={editRule?.titleCy} placeholder="auto from Uzbek" className={inp} /></F>
            <F label="Title — Русский"><input name="titleRu" required defaultValue={editRule?.titleRu} className={inp} /></F>
            <F label="Text — O'zbek"><textarea name="bodyUz" required rows={6} defaultValue={editRule?.bodyUz} className="input py-2 text-sm" /></F>
            <F label="Text — Кирилл"><textarea name="bodyCy" rows={6} defaultValue={editRule?.bodyCy} placeholder="auto from Uzbek" className="input py-2 text-sm" /></F>
            <F label="Text — Русский"><textarea name="bodyRu" required rows={6} defaultValue={editRule?.bodyRu} className="input py-2 text-sm" /></F>
            <div className="sm:col-span-2 lg:col-span-3"><button className="btn-primary btn-sm">{editRule ? 'Save article' : 'Add article'}</button></div>
          </form>
        </section>
      )}

      {tab === 'signs' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {signs.map((s) => (
            <div key={s.id} className="card flex items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.imageUrl} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <p className="text-xs muted">{s.group} · <span className="font-mono">{s.code}</span></p>
                <p className="truncate font-semibold">{s.nameUz}</p>
                <p className="truncate text-xs muted">{s.nameRu}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Link href={`/admin/library?tab=signs&edit=${s.id}#form`} className="btn-ghost btn-sm">Edit</Link>
                <form action={deleteLibraryItem}>
                  <input type="hidden" name="type" value="sign" /><input type="hidden" name="id" value={s.id} />
                  <ConfirmButton message={`Delete sign “${s.nameUz}”?`} className="btn-ghost btn-sm text-red-600">Delete</ConfirmButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>№</th><th>Title</th><th>Chapter</th><th>Text</th><th></th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono font-semibold">{r.number}</td>
                  <td>{r.titleUz}<p className="text-xs muted">{r.titleRu}</p></td>
                  <td className="text-xs">{r.chapter}</td>
                  <td className="max-w-md truncate text-xs muted">{r.bodyUz}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-1">
                      <Link href={`/admin/library?tab=rules&edit=${r.id}#form`} className="btn-ghost btn-sm">Edit</Link>
                      <form action={deleteLibraryItem}>
                        <input type="hidden" name="type" value="rule" /><input type="hidden" name="id" value={r.id} />
                        <ConfirmButton message={`Delete article ${r.number}? Questions referring to it keep the reference text.`} className="btn-ghost btn-sm text-red-600">Delete</ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
