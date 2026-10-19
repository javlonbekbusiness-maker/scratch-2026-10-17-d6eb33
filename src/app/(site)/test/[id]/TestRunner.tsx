'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';
import { toggleBookmark, saveNote } from '@/app/actions';
import { formatDuration } from '@/lib/format';

type Result = {
  answerId: string | null;
  correct?: boolean;
  correctId?: string | null;
  explanation?: string;
  ruleRef?: string | null;
};

export type RunnerQuestion = {
  id: string;
  text: string;
  imageUrl: string | null;
  answers: { id: string; text: string }[];
  bookmarked: boolean;
  note: string;
  result: Result | null;
};

export function TestRunner(props: {
  sessionId: string;
  title: string;
  practice: boolean;
  questions: RunnerQuestion[];
  startedAt: string;
  timeLimitSec: number | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [qs, setQs] = useState(props.questions);
  const firstOpen = props.questions.findIndex((q) => !q.result);
  const [idx, setIdx] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const finishedRef = useRef(false);

  const q = qs[idx];
  const answeredCount = qs.filter((x) => x.result).length;

  const finish = useCallback(
    async (force = false) => {
      if (finishedRef.current) return;
      const unanswered = qs.length - qs.filter((x) => x.result).length;
      if (!force && unanswered > 0 && !confirm(`${t('test.finishConfirm')}\n${t('test.unanswered', { n: unanswered })}`)) return;
      finishedRef.current = true;
      setFinishing(true);
      try {
        const r = await fetch('/api/tests/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: props.sessionId }) });
        if (r.ok) return router.replace(`/results/${props.sessionId}`);
        const j = await r.json().catch(() => ({}));
        setFinishing(false);
        if (r.status === 429 || r.status === 422) {
          // Final answer from the server (daily limit / invalid test): don't offer a retry.
          setBlocked(j.message ?? t('common.error'));
          return;
        }
        finishedRef.current = false;
        setError(j.message ?? t('common.error'));
      } catch {
        finishedRef.current = false;
        setFinishing(false);
        setError(t('test.offline'));
      }
    },
    [qs, props.sessionId, router, t],
  );

  // Exam countdown, measured from the server's start time.
  useEffect(() => {
    if (!props.timeLimitSec) return;
    const end = new Date(props.startedAt).getTime() + props.timeLimitSec * 1000;
    const tick = () => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) finish(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [props.startedAt, props.timeLimitSec, finish]);

  const choose = useCallback(
    async (answerId: string) => {
      if (busy || q.result) return;
      setBusy(true);
      setError(null);
      // Show the choice immediately; the server confirms correctness.
      setQs((prev) => prev.map((x, i) => (i === idx ? { ...x, result: { answerId } } : x)));
      try {
        const r = await fetch('/api/tests/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: props.sessionId, questionId: q.id, answerId }),
        });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        setQs((prev) => prev.map((x, i) => (i === idx ? { ...x, result: { answerId, ...j } } : x)));
        if (!props.practice) {
          const nextOpen = qs.findIndex((x, i) => i > idx && !x.result);
          if (nextOpen !== -1) setTimeout(() => setIdx(nextOpen), 250);
        }
      } catch {
        setQs((prev) => prev.map((x, i) => (i === idx ? { ...x, result: null } : x)));
        setError(t('test.offline'));
      } finally {
        setBusy(false);
      }
    },
    [busy, q, idx, props.sessionId, props.practice, qs, t],
  );

  // Keyboard: 1–5 picks an answer, arrows navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.answers.length) choose(q.answers[n - 1].id);
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(qs.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, qs.length, choose]);

  const r = q.result;
  const revealed = props.practice && r?.correct !== undefined;

  if (blocked)
    return (
      <div className="container-app max-w-xl py-16">
        <div className="card p-6 text-center" role="alert">
          <p className="text-4xl" aria-hidden>⏳</p>
          <p className="mt-3 font-semibold">{blocked}</p>
          <a href="/tests" className="btn-primary mt-5 inline-flex">{t('limit.backToTests')}</a>
        </div>
      </div>
    );

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 pb-28 pt-4 sm:px-6">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <h1 className="truncate text-sm font-semibold muted">{props.title}</h1>
        <span className="ml-auto text-sm font-bold tabular-nums">{t('test.progress', { i: idx + 1, n: qs.length })}</span>
        {left !== null && (
          <span
            className={`chip text-sm tabular-nums ${left < 60 ? 'animate-pulse bg-red-500 text-white' : 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'}`}
            role="timer"
            aria-label={t('test.timeLeft')}
          >
            ⏱ {formatDuration(left)}
          </span>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden>
        <div className="h-full rounded-full bg-mint-500 transition-all duration-500" style={{ width: `${(answeredCount / qs.length) * 100}%` }} />
      </div>

      {/* Navigator */}
      <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Questions">
        {qs.map((x, i) => {
          const res = x.result;
          const color =
            props.practice && res?.correct !== undefined
              ? res.correct
                ? 'bg-mint-500 text-white'
                : 'bg-red-500 text-white'
              : res
                ? 'bg-brand-500 text-white'
                : 'bg-slate-200 dark:bg-slate-800';
          return (
            <button
              key={x.id}
              onClick={() => setIdx(i)}
              className={`grid h-9 min-w-[36px] place-items-center rounded-lg text-xs font-bold ${color} ${i === idx ? 'ring-2 ring-brand-600 ring-offset-2 dark:ring-offset-slate-950' : ''}`}
              aria-label={`${i + 1}`}
              aria-current={i === idx ? 'step' : undefined}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      {/* Question */}
      <article key={q.id} className="card mt-4 animate-fade-up overflow-hidden">
        {q.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.imageUrl} alt="" width={640} height={360} className="aspect-video w-full bg-slate-100 object-contain dark:bg-slate-800" />
        )}
        <div className="p-5">
          <div className="flex items-start gap-3">
            <p className="flex-1 text-lg font-semibold leading-snug">{q.text}</p>
            <BookmarkButton q={q} onChange={(v) => setQs((p) => p.map((x) => (x.id === q.id ? { ...x, bookmarked: v } : x)))} />
          </div>
          <ul className="mt-4 space-y-2.5">
            {q.answers.map((a, i) => {
              const picked = r?.answerId === a.id;
              let cls = 'border-slate-200 hover:border-brand-400 dark:border-slate-700';
              if (revealed) {
                if (a.id === r!.correctId) cls = 'border-mint-500 bg-mint-50 dark:bg-mint-900/30' + (picked ? ' animate-pop' : '');
                else if (picked) cls = 'animate-shake border-red-400 bg-red-50 dark:bg-red-900/30';
                else cls = 'border-slate-200 opacity-70 dark:border-slate-700';
              } else if (picked) cls = 'border-brand-500 bg-brand-50 dark:bg-brand-950';
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => choose(a.id)}
                    disabled={!!r || busy}
                    className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${cls}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-bold dark:bg-slate-800">{i + 1}</span>
                    <span>{a.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

          {revealed && (
            <div className="mt-5 animate-fade-up space-y-3">
              <div className={`rounded-2xl p-4 ${r!.correct ? 'bg-mint-50 dark:bg-mint-900/20' : 'bg-red-50 dark:bg-red-900/20'}`} role="status">
                <p className="font-bold">{r!.correct ? `✅ ${t('test.correct')}` : `❌ ${t('test.wrong')}`}</p>
                {r!.explanation && <p className="mt-1 text-sm">{r!.explanation}</p>}
                {r!.ruleRef && <p className="mt-2 text-xs font-semibold text-brand-700 dark:text-brand-300">📖 {t('test.rule', { ref: r!.ruleRef })}</p>}
              </div>
              <AiExplain questionId={q.id} />
            </div>
          )}
          <NoteBox q={q} onSaved={(text) => setQs((p) => p.map((x) => (x.id === q.id ? { ...x, note: text } : x)))} />
        </div>
      </article>

      {/* Bottom actions */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-3xl gap-2 px-4 py-3 sm:px-6">
          <button className="btn-secondary px-4" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} aria-label={t('common.prev')}>
            ←
          </button>
          {idx < qs.length - 1 ? (
            <button className="btn-primary flex-1" onClick={() => setIdx((i) => i + 1)}>
              {t('common.next')} →
            </button>
          ) : (
            <button className="btn-cta flex-1" onClick={() => finish()} disabled={finishing}>
              {finishing ? t('common.loading') : t('common.finish')}
            </button>
          )}
          {idx < qs.length - 1 && (
            <button className="btn-ghost px-4 text-sm" onClick={() => finish()} disabled={finishing}>
              {t('common.finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BookmarkButton({ q, onChange }: { q: RunnerQuestion; onChange: (v: boolean) => void }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => onChange(await toggleBookmark(q.id)))}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl ${q.bookmarked ? 'bg-cta-500/15' : 'bg-slate-100 dark:bg-slate-800'}`}
      aria-pressed={q.bookmarked}
      aria-label={q.bookmarked ? t('test.bookmarked') : t('test.bookmark')}
      title={q.bookmarked ? t('test.bookmarked') : t('test.bookmark')}
    >
      {q.bookmarked ? '★' : '☆'}
    </button>
  );
}

function NoteBox({ q, onSaved }: { q: RunnerQuestion; onSaved: (t: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(!!q.note);
  const [text, setText] = useState(q.note);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setText(q.note); setOpen(!!q.note); }, [q.id, q.note]);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 text-sm font-medium text-brand-600 hover:underline">
        📝 {t('test.note')}
      </button>
    );
  return (
    <div className="mt-4">
      <label htmlFor={`note-${q.id}`} className="label">📝 {t('test.note')}</label>
      <textarea
        id={`note-${q.id}`}
        value={text}
        maxLength={2000}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        onBlur={async () => { if (text !== q.note) { await saveNote(q.id, text); onSaved(text); setSaved(true); } }}
        placeholder={t('test.notePlaceholder')}
        rows={2}
        className="input min-h-[72px] py-3"
      />
      {saved && <p className="mt-1 text-xs text-mint-700">{t('common.saved')}</p>}
    </div>
  );
}

function AiExplain({ questionId }: { questionId: string }) {
  const { t } = useT();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => setText(null), [questionId]);
  async function run() {
    setLoading(true);
    try {
      const r = await fetch('/api/ai/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId }) });
      const j = await r.json();
      setText(r.ok ? j.text : t('common.error'));
    } catch {
      setText(t('common.error'));
    } finally {
      setLoading(false);
    }
  }
  if (text)
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4 text-sm dark:border-brand-900 dark:bg-brand-950/40">
        <p className="mb-1 font-semibold">✨ {t('test.aiTitle')}</p>
        <p className="whitespace-pre-line">{text}</p>
      </div>
    );
  return (
    <button type="button" onClick={run} disabled={loading} className="btn-secondary btn-sm">
      ✨ {loading ? t('test.aiLoading') : t('test.explainAi')}
    </button>
  );
}
