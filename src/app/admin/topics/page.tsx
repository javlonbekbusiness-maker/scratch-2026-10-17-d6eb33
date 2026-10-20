import { requireAdmin } from '@/lib/session';
import { db } from '@/lib/db';
import { ICON_NAMES, Icon, isIconName } from '@/components/ui/Icon';
import { IconTile, TONES, toTone } from '@/components/ui/Cards';
import { deleteTopic, deleteTopicGroup, moveTopic, saveTopic, saveTopicGroup } from '../actions';
import { Badge, PageHeader, inputSm } from '../ui';
import { ConfirmButton } from '../ConfirmButton';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, [string, boolean]> = {
  'topic-created': ['Topic created.', true],
  'topic-saved': ['Topic saved.', true],
  'topic-moved': ['Order updated.', true],
  'topic-deleted': ['Topic deleted.', true],
  'topic-name': ['Uzbek and Russian names are required (max 200 characters).', false],
  'topic-slug': ['Slug: 2–31 lowercase letters, digits or hyphens.', false],
  'topic-exists': ['A topic with this slug already exists.', false],
  'topic-icon': ['Pick an icon from the list.', false],
  'topic-library': ['Library link must start with /library (e.g. /library?tab=signs).', false],
  'topic-in-use': ['This topic still has questions; move them to another topic first, or hide it.', false],
  'topic-in-mix': ['An exam template topic mix uses this topic; edit the template first.', false],
  'group-created': ['Group created.', true],
  'group-saved': ['Group saved.', true],
  'group-deleted': ['Group deleted.', true],
  'group-name': ['Uzbek and Russian names are required (max 80 characters).', false],
  'group-tone': ['Pick a colour.', false],
  'group-exists': ['A group with this slug already exists.', false],
  'group-in-use': ['Move this group’s topics to another group before deleting it.', false],
  'group-missing': ['That group no longer exists.', false],
  'bad-order': ['Order must be a whole number.', false],
};

const F = ({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) => (
  <label className={`block ${className}`}>
    <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide muted">{label}</span>
    {children}
  </label>
);

export default async function TopicsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [groups, topics, counts, active] = await Promise.all([
    db.topicGroup.findMany({ orderBy: [{ sortOrder: 'asc' }, { nameUz: 'asc' }] }),
    db.topic.findMany({ orderBy: [{ sortOrder: 'asc' }, { nameUz: 'asc' }] }),
    db.question.groupBy({ by: ['topicId'], _count: true }),
    db.question.groupBy({ by: ['topicId'], where: { isActive: true }, _count: true }),
  ]);
  const all = new Map(counts.map((r) => [r.topicId, r._count]));
  const published = new Map(active.map((r) => [r.topicId, r._count]));
  const msg = sp.msg ? MESSAGES[sp.msg] : undefined;
  const sections = [...groups.map((g) => ({ group: g, items: topics.filter((t) => t.groupId === g.id) })), { group: null, items: topics.filter((t) => !t.groupId || !groups.some((g) => g.id === t.groupId)) }].filter((s) => s.group || s.items.length);

  const topicFields = (t?: (typeof topics)[number]) => (
    <>
      <F label="Name — O'zbek" className="sm:col-span-2"><input name="nameUz" required maxLength={200} defaultValue={t?.nameUz} className={inputSm} /></F>
      <F label="Name — Русский" className="sm:col-span-2"><input name="nameRu" required maxLength={200} defaultValue={t?.nameRu} className={inputSm} /></F>
      <F label="Description — O'zbek" className="sm:col-span-2"><input name="descUz" maxLength={300} defaultValue={t?.descUz} className={inputSm} /></F>
      <F label="Description — Русский" className="sm:col-span-2"><input name="descRu" maxLength={300} defaultValue={t?.descRu} className={inputSm} /></F>
      <F label="Group">
        <select name="groupId" defaultValue={t?.groupId ?? ''} className={inputSm}>
          <option value="">— none</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.nameUz}</option>)}
        </select>
      </F>
      <F label="Icon">
        <select name="icon" defaultValue={t && isIconName(t.icon) ? t.icon : 'book'} className={inputSm}>
          {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </F>
      <F label="Rules reference"><input name="ruleRef" maxLength={40} defaultValue={t?.ruleRef ?? ''} placeholder="7-bob" className={inputSm} /></F>
      <F label="Library link"><input name="libraryHref" defaultValue={t?.libraryHref ?? ''} placeholder="/library?tab=rules" className={inputSm} /></F>
      <F label="Order"><input name="sortOrder" type="number" defaultValue={t?.sortOrder ?? 0} className={inputSm} /></F>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={t?.isActive ?? true} className="h-4 w-4" /> Visible to users</label>
    </>
  );

  return (
    <>
      <PageHeader
        title="Topics"
        desc="Topics follow the chapters and sections of the Traffic Rules (Resolution No. 172, 12.04.2022). Question counts are computed from the database; topics with no published questions are hidden from users automatically."
      />
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${msg[1] ? 'bg-mint-500/10 text-mint-700' : 'bg-red-500/10 text-red-700'}`}>{msg[0]}</p>}

      <h2 className="mb-2 text-lg font-bold">Groups</h2>
      <p className="mb-3 text-xs muted">Headings on the topics page. All topics in a group share its colour.</p>
      <div className="space-y-2">
        {groups.map((g) => {
          const n = topics.filter((t) => t.groupId === g.id).length;
          return (
            <div key={g.id} className="card flex flex-wrap items-end gap-2 p-3">
              <form action={saveTopicGroup} className="grid flex-1 items-end gap-2 sm:grid-cols-6">
                <input type="hidden" name="id" value={g.id} />
                <F label="Name — O'zbek" className="sm:col-span-2"><input name="nameUz" required maxLength={80} defaultValue={g.nameUz} className={inputSm} /></F>
                <F label="Name — Русский" className="sm:col-span-2"><input name="nameRu" required maxLength={80} defaultValue={g.nameRu} className={inputSm} /></F>
                <F label="Colour">
                  <select name="tone" defaultValue={g.tone} className={inputSm}>{TONES.map((tn) => <option key={tn} value={tn}>{tn}</option>)}</select>
                </F>
                <F label="Order"><input name="sortOrder" type="number" defaultValue={g.sortOrder} className={inputSm} /></F>
                <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
                  <IconTile icon="layers" tone={toTone(g.tone)} size="sm" />
                  <span className="font-mono text-xs muted">{g.slug}</span>
                  <span className="text-xs muted">{n} topics</span>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={g.isActive} className="h-4 w-4" /> Visible</label>
                  {!g.isActive && <Badge>hidden</Badge>}
                  <button className="btn-primary btn-sm ml-auto">Save group</button>
                </div>
              </form>
              {n === 0 && (
                <form action={deleteTopicGroup}>
                  <input type="hidden" name="id" value={g.id} />
                  <ConfirmButton message={`Delete group ${g.nameUz}?`} className="btn-ghost btn-sm text-red-600">Delete</ConfirmButton>
                </form>
              )}
            </div>
          );
        })}
        <form action={saveTopicGroup} className="card grid items-end gap-2 border-dashed p-3 sm:grid-cols-6">
          <F label="Slug"><input name="slug" required placeholder="e.g. vehicles" className={`${inputSm} font-mono`} /></F>
          <F label="Name — O'zbek" className="sm:col-span-2"><input name="nameUz" required maxLength={80} className={inputSm} /></F>
          <F label="Name — Русский" className="sm:col-span-2"><input name="nameRu" required maxLength={80} className={inputSm} /></F>
          <F label="Colour"><select name="tone" defaultValue="brand" className={inputSm}>{TONES.map((tn) => <option key={tn} value={tn}>{tn}</option>)}</select></F>
          <input type="hidden" name="sortOrder" value={(groups.length + 1) * 10} />
          <input type="hidden" name="isActive" value="on" />
          <button className="btn-secondary btn-sm sm:col-span-6">+ Add group</button>
        </form>
      </div>

      {sections.map(({ group, items }) => (
        <section key={group?.id ?? 'none'} className="mt-8" aria-label={group?.nameUz ?? 'No group'}>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            {group && <IconTile icon="layers" tone={toTone(group.tone)} size="sm" />}
            {group?.nameUz ?? 'No group'} <span className="text-sm font-normal muted">({items.length})</span>
          </h2>
          <div className="space-y-2">
            {items.map((t, i) => {
              const pub = published.get(t.id) ?? 0;
              return (
                <div key={t.id} id={`t-${t.id}`} className="card scroll-mt-6 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <IconTile icon={isIconName(t.icon) ? t.icon : 'book'} tone={toTone(group?.tone)} size="sm" />
                    <span className="font-mono text-xs">{t.slug}</span>
                    <span className="text-xs muted">{pub} published · {all.get(t.id) ?? 0} total questions</span>
                    {!t.isActive && <Badge>hidden</Badge>}
                    {t.isActive && pub === 0 && <Badge tone="amber">no published questions — not shown</Badge>}
                    <span className="ml-auto flex gap-1">
                      <form action={moveTopic}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="dir" value="up" /><button className="btn-ghost btn-sm" disabled={i === 0} aria-label={`Move ${t.nameUz} up`}>↑</button></form>
                      <form action={moveTopic}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="dir" value="down" /><button className="btn-ghost btn-sm" disabled={i === items.length - 1} aria-label={`Move ${t.nameUz} down`}>↓</button></form>
                    </span>
                  </div>
                  <form action={saveTopic} className="grid items-end gap-2 sm:grid-cols-4 xl:grid-cols-8">
                    <input type="hidden" name="id" value={t.id} />
                    {topicFields(t)}
                    <div className="flex items-center gap-2 sm:col-span-4 xl:col-span-8">
                      <button className="btn-primary btn-sm ml-auto">Save topic</button>
                    </div>
                  </form>
                  {!all.get(t.id) && (
                    <form action={deleteTopic} className="mt-1 text-right">
                      <input type="hidden" name="id" value={t.id} />
                      <ConfirmButton message={`Delete topic ${t.slug}?`} className="btn-ghost btn-sm text-red-600">Delete</ConfirmButton>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section id="new-topic" className="mt-8 scroll-mt-6">
        <h2 className="mb-3 text-lg font-bold">New topic</h2>
        <form action={saveTopic} className="card grid items-end gap-2 border-dashed p-3 sm:grid-cols-4 xl:grid-cols-8">
          <F label="Slug" className="sm:col-span-2"><input name="slug" required placeholder="e.g. ch-30" className={`${inputSm} font-mono`} /></F>
          {topicFields()}
          <button className="btn-secondary btn-sm sm:col-span-4 xl:col-span-8"><Icon name="check" size={16} /> Add topic</button>
        </form>
      </section>
    </>
  );
}
