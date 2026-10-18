import { requireAdmin } from '@/lib/session';
import Link from 'next/link';
import { db } from '@/lib/db';
import { examTemplateAction } from '../actions';
import { Badge, PageHeader } from '../ui';
import { ConfirmButton } from '../ConfirmButton';
import { TemplateForm } from './TemplateForm';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, [string, boolean]> = {
  created: ['Template created.', true],
  saved: ['Template saved. New exams use it immediately; exams already in progress keep their settings.', true],
  duplicated: ['Copy created; edit it below.', true],
  default: ['Default updated for this category (exams start with the default exam template; the default ticket template is preselected for generation).', true],
  deleted: ['Template deleted.', true],
  'delete-default': ['This is the default template. Make another one the default first.', false],
};

export default async function ExamTemplatesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [templates, categories, topics, perCategory, perCategoryTopic] = await Promise.all([
    db.examTemplate.findMany({ include: { category: true }, orderBy: [{ category: { sortOrder: 'asc' } }, { kind: 'asc' }, { createdAt: 'asc' }] }),
    db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.topic.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.question.groupBy({ by: ['categoryId'], where: { isActive: true }, _count: true }),
    db.question.groupBy({ by: ['categoryId', 'topicId'], where: { isActive: true }, _count: true }),
  ]);
  const available = new Map(perCategory.map((r) => [r.categoryId, r._count]));
  const topicSlug = new Map(topics.map((t) => [t.id, t.slug]));
  const availableTopic = new Map(perCategoryTopic.map((r) => [`${r.categoryId}:${r.topicId ? topicSlug.get(r.topicId) : ''}`, r._count]));
  const editing = sp.edit && sp.edit !== 'new' ? templates.find((t) => t.id === sp.edit) : null;
  const msg = sp.msg ? MESSAGES[sp.msg] : undefined;
  const mixText = (m: unknown) => Object.entries((m ?? {}) as Record<string, number>).map(([k, v]) => `${k}: ${v}`).join(', ');

  return (
    <>
      <PageHeader
        title="Exam templates"
        desc="Exam simulation format per licence category, and ticket templates for auto-generating practice tickets."
        actions={<Link href="/admin/exam?edit=new#form" className="btn-primary btn-sm">+ New template</Link>}
      />
      <p className="mb-4 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        Check the current official exam format (number of questions, time limit, allowed mistakes) and set it on each category&apos;s default exam template. The seeded 20 questions / 25 min / 90% are placeholders.
      </p>
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${msg[1] ? 'bg-mint-500/10 text-mint-700' : 'bg-red-500/10 text-red-700'}`}>{msg[0]}</p>}

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Template</th><th>Category</th><th>Kind</th><th>Questions</th><th>Time</th><th>Pass</th><th>Topic mix</th><th></th></tr></thead>
          <tbody>
            {templates.map((t) => {
              const have = available.get(t.categoryId) ?? 0;
              const mix = (t.topicMix ?? {}) as Record<string, number>;
              const shortTopics = Object.entries(mix).filter(([slug, need]) => (availableTopic.get(`${t.categoryId}:${slug}`) ?? 0) < need).map(([slug]) => slug);
              const mistakes = t.questionCount - Math.ceil((t.questionCount * t.passPercent) / 100);
              return (
                <tr key={t.id}>
                  <td>
                    <Link href={`/admin/exam?edit=${t.id}#form`} className="font-semibold hover:underline">{t.name}</Link>
                    {t.isDefault && <Badge tone="blue">default</Badge>}
                    {have < t.questionCount && <p className="text-xs text-red-600">Only {have} active questions in {t.category.code}</p>}
                    {shortTopics.length > 0 && <p className="text-xs text-amber-700">Not enough questions in: {shortTopics.join(', ')} (filled randomly)</p>}
                  </td>
                  <td>{t.category.code}</td>
                  <td>{t.kind === 'EXAM' ? 'Exam' : 'Ticket'}</td>
                  <td className="tabular-nums">{t.questionCount}</td>
                  <td className="tabular-nums">{t.kind === 'EXAM' ? `${Math.round(t.timeLimitSec / 60)} min` : '—'}</td>
                  <td className="tabular-nums">{t.passPercent}% <span className="text-xs muted">({Math.max(0, mistakes)} mistakes)</span></td>
                  <td className="font-mono text-xs">{mixText(t.topicMix) || <span className="muted">random</span>}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-1">
                      <Link href={`/admin/exam?edit=${t.id}#form`} className="btn-ghost btn-sm">Edit</Link>
                      <form action={examTemplateAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="op" value="duplicate" /><button className="btn-ghost btn-sm">Duplicate</button></form>
                      {!t.isDefault && (
                        <form action={examTemplateAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="op" value="default" /><button className="btn-ghost btn-sm">Make default</button></form>
                      )}
                      <form action={examTemplateAction}>
                        <input type="hidden" name="id" value={t.id} /><input type="hidden" name="op" value="delete" />
                        <ConfirmButton message={`Delete template “${t.name}”?`} className="btn-ghost btn-sm text-red-600">Delete</ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(editing || sp.edit === 'new') && (
        <section id="form" className="card mt-6 scroll-mt-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? `Edit: ${editing.name}` : 'New template'}</h2>
            <Link href="/admin/exam" className="btn-ghost btn-sm">Close</Link>
          </div>
          <TemplateForm
            key={editing?.id ?? 'new'}
            categories={categories.map((c) => ({ value: c.id, label: `${c.code} — ${c.nameUz}` }))}
            topics={topics.map((t) => ({ slug: t.slug, label: t.nameUz }))}
            defaults={
              editing
                ? {
                    id: editing.id, name: editing.name, kind: editing.kind, categoryId: editing.categoryId, questionCount: String(editing.questionCount),
                    timeLimitMin: String(Math.round(editing.timeLimitSec / 60) || 25), passPercent: String(editing.passPercent), topicMix: mixText(editing.topicMix),
                  }
                : { kind: 'EXAM', categoryId: categories.find((c) => c.code === 'B')?.id ?? categories[0]?.id, questionCount: '20', timeLimitMin: '25', passPercent: '90' }
            }
          />
        </section>
      )}
    </>
  );
}
