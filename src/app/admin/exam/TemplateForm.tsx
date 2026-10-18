'use client';

import { useActionState, useState } from 'react';
import { saveExamTemplate, type TemplateFormState } from '../actions';

export type TemplateDefaults = Partial<{ id: string; name: string; kind: string; categoryId: string; questionCount: string; timeLimitMin: string; passPercent: string; topicMix: string }>;

const inp = 'input min-h-[40px] rounded-xl px-3 text-sm';

export function TemplateForm({ defaults = {}, categories, topics }: { defaults?: TemplateDefaults; categories: { value: string; label: string }[]; topics: { slug: string; label: string }[] }) {
  const [state, action, pending] = useActionState<TemplateFormState, FormData>(saveExamTemplate, null);
  const v = (k: keyof TemplateDefaults) => {
    const sv = state?.values[k];
    if (sv !== undefined) return String(sv);
    return defaults[k] ?? '';
  };
  const [kind, setKind] = useState(v('kind') || 'EXAM');
  const [count, setCount] = useState(Number(v('questionCount') || 20));
  const [pass, setPass] = useState(Number(v('passPercent') || 90));
  const allowedMistakes = count - Math.ceil((count * pass) / 100);

  return (
    <form key={state?.attempt ?? 0} action={action} className="space-y-4">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {state?.error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300">{state.error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block lg:col-span-2">
          <span className="label">Name</span>
          <input name="name" required maxLength={80} defaultValue={v('name')} className={inp} />
        </label>
        <label className="block">
          <span className="label">Kind</span>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inp}>
            <option value="EXAM">Exam simulation</option>
            <option value="TICKET">Ticket (for auto-generation)</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Category</span>
          <select name="categoryId" defaultValue={v('categoryId')} className={inp}>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">{kind === 'EXAM' ? 'Questions per exam' : 'Questions per ticket'}</span>
          <input name="questionCount" type="number" min={1} max={100} required value={count || ''} onChange={(e) => setCount(Number(e.target.value))} className={inp} />
        </label>
        {kind === 'EXAM' && (
          <label className="block">
            <span className="label">Time limit (minutes)</span>
            <input name="timeLimitMin" type="number" min={1} max={180} required defaultValue={v('timeLimitMin') || '25'} className={inp} />
          </label>
        )}
        <label className="block">
          <span className="label">Pass mark (%)</span>
          <input name="passPercent" type="number" min={1} max={100} required value={pass || ''} onChange={(e) => setPass(Number(e.target.value))} className={inp} />
          {count > 0 && pass > 0 && (
            <span className="mt-1 block text-xs muted">= at least {count - Math.max(0, allowedMistakes)} of {count} correct ({Math.max(0, allowedMistakes)} mistakes allowed)</span>
          )}
        </label>
      </div>
      <label className="block">
        <span className="label">Topic mix <span className="font-normal muted">(optional; topic:count, comma-separated; the rest is random)</span></span>
        <input name="topicMix" defaultValue={v('topicMix')} placeholder="signs: 5, priority: 3" className={`${inp} font-mono`} />
        <span className="mt-1 block text-xs muted">Topics: {topics.map((t) => `${t.slug} (${t.label})`).join(', ')}</span>
      </label>
      <button disabled={pending} className="btn-primary btn-sm">{pending ? 'Saving…' : defaults.id ? 'Save template' : 'Create template'}</button>
    </form>
  );
}
