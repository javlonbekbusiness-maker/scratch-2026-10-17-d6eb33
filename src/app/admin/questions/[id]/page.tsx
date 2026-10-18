import { requireAdmin } from '@/lib/session';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { deleteQuestion, saveQuestion } from '../../actions';
import { Field, PageHeader, inputSm } from '../../ui';
import { QuestionFormChecks } from './QuestionFormChecks';

const ERRORS: Record<string, string> = {
  text: 'Question text in Uzbek and Russian is required.',
  answers: 'Fill in 3 to 5 answers.',
  'answer-langs': 'Every answer needs Uzbek and Russian text.',
  correct: 'Select the correct answer (it must be one of the filled rows).',
  category: 'Choose a category.',
  ticket: 'Ticket number must be a whole number from 1 to 999.',
  'image-url': 'Image URL must start with https:// or /.',
  'image-file': 'The image must be a PNG, JPEG or WebP file under 2 MB. Nothing was saved.',
};

export default async function EditQuestion({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { err } = await searchParams;
  const isNew = id === 'new';
  const [q, cats, topics] = await Promise.all([
    isNew ? null : db.question.findUnique({ where: { id }, include: { answers: { orderBy: { sortOrder: 'asc' } } } }),
    db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.topic.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);
  if (!isNew && !q) notFound();
  const answers = Array.from({ length: 5 }, (_, i) => q?.answers[i]);
  const correctIdx = q ? q.answers.findIndex((a) => a.isCorrect) : 0;

  const L3 = ({ name, label, rows = 1 }: { name: 'text' | 'explanation'; label: string; rows?: number }) => (
    <div className="grid gap-3 md:grid-cols-3">
      {(['Uz', 'Cy', 'Ru'] as const).map((sfx) => {
        const key = `${name}${sfx}` as const;
        const val = (q?.[key as keyof typeof q] as string | undefined) ?? '';
        const hint = sfx === 'Cy' ? 'Leave empty to auto-transliterate from Latin' : undefined;
        const lbl = `${label} — ${sfx === 'Uz' ? "O'zbek (lotin)" : sfx === 'Cy' ? 'Ўзбек (кирилл)' : 'Русский'}`;
        return (
          <Field key={key} label={lbl} hint={hint}>
            {rows > 1 ? <textarea name={key} defaultValue={val} rows={rows} className="input py-2 text-sm" required={sfx !== 'Cy' && name === 'text'} /> : <input name={key} defaultValue={val} className={inputSm} required={sfx !== 'Cy'} />}
          </Field>
        );
      })}
    </div>
  );

  return (
    <>
      <PageHeader title={isNew ? 'New question' : 'Edit question'} actions={<Link href="/admin/questions" className="btn-ghost btn-sm">← Back</Link>} />
      {err && ERRORS[err] && <p role="status" className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700">{ERRORS[err]}</p>}
      <form action={saveQuestion} className="space-y-6">
        <QuestionFormChecks />
        <input type="hidden" name="id" value={q?.id ?? ''} />
        {/* Previous Uzbek text lets the server refresh auto-generated Cyrillic when the Uzbek changes. */}
        {q && (
          <>
            <input type="hidden" name="textUzPrev" value={q.textUz} />
            <input type="hidden" name="explanationUzPrev" value={q.explanationUz} />
            {q.answers.map((a, i) => <input key={a.id} type="hidden" name={`a${i}_uzPrev`} value={a.textUz} />)}
          </>
        )}
        <section className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Category">
            <select name="categoryId" defaultValue={q?.categoryId} className={inputSm} required>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </Field>
          <Field label="Topic">
            <select name="topicId" defaultValue={q?.topicId ?? ''} className={inputSm}>
              <option value="">—</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.nameUz}</option>)}
            </select>
          </Field>
          <Field label="Ticket #"><input name="ticketNumber" type="number" min={1} defaultValue={q?.ticketNumber ?? ''} className={inputSm} /></Field>
          <Field label="Order in ticket"><input name="sortOrder" type="number" defaultValue={q?.sortOrder ?? 0} className={inputSm} /></Field>
          <Field label="Rule reference"><input name="ruleRef" defaultValue={q?.ruleRef ?? ''} placeholder="e.g. 10.4" className={inputSm} /></Field>
          <Field label="Difficulty">
            <select name="difficulty" defaultValue={q?.difficulty ?? 1} className={inputSm}>
              <option value={1}>1 — easy</option><option value={2}>2</option><option value={3}>3 — hard</option>
            </select>
          </Field>
        </section>

        <section className="card space-y-4 p-5">
          <L3 name="text" label="Question" rows={3} />
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
            <Field label="Image URL" hint="https://… or /placeholders/…"><input name="imageUrl" defaultValue={q?.imageUrl ?? ''} className={inputSm} /></Field>
            <span className="pb-2 text-center text-sm muted">or</span>
            <Field label="Upload (PNG/JPEG/WebP, ≤2 MB)"><input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" /></Field>
          </div>
          {q?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.imageUrl} alt="" className="max-h-40 rounded-xl border border-slate-200 dark:border-slate-700" />
          )}
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-bold">Answers <span className="text-sm font-normal muted">(3–5; leave unused rows empty, select the correct one)</span></h2>
          {answers.map((a, i) => (
            <div key={i} className="grid items-center gap-2 md:grid-cols-[auto_1fr_1fr_1fr]">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="radio" name="correct" value={i} defaultChecked={i === correctIdx} className="h-5 w-5 accent-mint-600" /> {i + 1}
              </label>
              <input name={`a${i}_uz`} defaultValue={a?.textUz ?? ''} placeholder="O'zbek (lotin)" className={inputSm} />
              <input name={`a${i}_cy`} defaultValue={a?.textCy ?? ''} placeholder="Кирилл (auto if empty)" className={inputSm} />
              <input name={`a${i}_ru`} defaultValue={a?.textRu ?? ''} placeholder="Русский" className={inputSm} />
            </div>
          ))}
        </section>

        <section className="card space-y-4 p-5">
          <L3 name="explanation" label="Explanation" rows={3} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={q?.isActive ?? true} className="h-5 w-5" /> Active (visible to users)</label>
        </section>

        <div className="flex gap-2">
          <button className="btn-primary">Save question</button>
          <Link href="/admin/questions" className="btn-ghost">Cancel</Link>
        </div>
      </form>
      {q && (
        <form action={deleteQuestion} className="mt-8 border-t border-slate-200 pt-4 dark:border-slate-800">
          <input type="hidden" name="id" value={q.id} />
          <button className="btn-ghost btn-sm text-red-600">Delete question permanently</button>
        </form>
      )}
    </>
  );
}
