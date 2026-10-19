'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';
import { toggleBookmark, saveNote } from '@/app/actions';
import { formatDuration } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';

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

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

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
  const [sheet, setSheet] = useState<'nav' | 'confirm' | null>(null);
  const finishedRef = useRef(false);

  const q = qs[idx];
  const answeredCount = qs.filter((x) => x.result).length;
  const unanswered = qs.length - answeredCount;

  const submit = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSheet(null);
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
  }, [props.sessionId, router, t]);

  /** Asks first when questions are still open (unless time ran out). */
  const finish = useCallback(
    (force = false) => {
      if (!force && qs.some((x) => !x.result)) return setSheet('confirm');
      submit();
    },
    [qs, submit],
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
      if (sheet || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.answers.length) choose(q.answers[n - 1].id);
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(qs.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, qs.length, choose, sheet]);

  const r = q.result;
  const revealed = props.practice && r?.correct !== undefined;

  if (blocked)
    return (
      <div className="page max-w-xl py-16">
        <div className="card p-6 text-center" role="alert">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warning/15 text-warning" aria-hidden><Icon name="timer" size={28} /></span>
          <p className="mt-4 font-semibold">{blocked}</p>
          <Link href="/tests" className="btn-primary mt-5 inline-flex">{t('limit.backToTests')}</Link>
        </div>
      </div>
    );

  const navState = (x: RunnerQuestion) =>
    props.practice && x.result?.correct !== undefined ? (x.result.correct ? 'correct' : 'wrong') : x.result ? 'answered' : 'open';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      {/* In-test header: the app's own bars are hidden while a test runs. */}
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/90 backdrop-blur-md">
        <div className="flex h-16 items-center gap-2 px-3 sm:px-4">
          <Link href="/dashboard" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-muted hover:bg-raised hover:text-ink" aria-label={t('test.exit')}>
            <Icon name="close" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-title">{props.title}</h1>
          {left !== null && (
            <span
              className={`num inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold ${left < 60 ? 'bg-danger text-white motion-safe:animate-pulse dark:text-canvas' : 'bg-raised text-ink'}`}
              role="timer"
              aria-label={`${t('test.timeLeft')}: ${formatDuration(left)}`}
            >
              <Icon name="timer" size={16} /> {formatDuration(left)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setSheet('nav')}
            className="num inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-bold pressable"
            aria-label={`${t('test.navigator')}: ${t('test.progress', { i: idx + 1, n: qs.length })}`}
          >
            <Icon name="grid" size={16} /> {t('test.progress', { i: idx + 1, n: qs.length })}
          </button>
          <BookmarkButton q={q} onChange={(v) => setQs((p) => p.map((x) => (x.id === q.id ? { ...x, bookmarked: v } : x)))} />
        </div>
        <div className="h-1 bg-raised" role="progressbar" aria-label={t('test.answeredN', { n: answeredCount })} aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={answeredCount}>
          <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${(answeredCount / qs.length) * 100}%` }} />
        </div>
      </header>

      {/* Question */}
      <div className="flex-1 px-3 pb-6 pt-4 sm:px-4">
        <article key={q.id} className="card motion-safe:animate-fade-up overflow-hidden">
          {q.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.imageUrl} alt="" width={640} height={360} className="aspect-video w-full bg-raised object-contain" />
          )}
          <div className="p-4 sm:p-5">
            <p className="text-micro font-semibold uppercase text-muted">{t('test.question', { i: idx + 1 })}</p>
            <p className="mt-1 text-[18px] font-semibold leading-snug">{q.text}</p>

            <ul className="mt-4 space-y-2.5" aria-label={t('test.answers')}>
              {q.answers.map((a, i) => {
                const picked = r?.answerId === a.id;
                const isRight = revealed && a.id === r!.correctId;
                const isWrong = revealed && picked && !isRight;
                const state = isRight ? 'right' : isWrong ? 'wrong' : picked ? 'picked' : revealed ? 'dim' : 'idle';
                const cls = {
                  idle: 'border-line bg-raised hover:border-brand-500/50',
                  picked: 'border-brand-500 bg-brand-600/10',
                  right: 'border-success bg-success/10 motion-safe:animate-pop',
                  wrong: 'border-danger bg-danger/10 motion-safe:animate-shake',
                  dim: 'border-line bg-raised opacity-60',
                }[state];
                const badge = {
                  idle: 'bg-surface text-muted',
                  picked: 'bg-brand-600 text-white',
                  right: 'bg-success text-white dark:text-canvas',
                  wrong: 'bg-danger text-white dark:text-canvas',
                  dim: 'bg-surface text-muted',
                }[state];
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => choose(a.id)}
                      disabled={!!r || busy}
                      aria-pressed={picked}
                      className={`flex min-h-[60px] w-full items-center gap-3 rounded-tile border-2 px-3 py-3 text-left transition duration-150 enabled:active:scale-[.99] ${cls}`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${badge}`} aria-hidden>
                        {state === 'right' ? <Icon name="check" size={18} /> : state === 'wrong' ? <Icon name="close" size={18} /> : LETTERS[i]}
                      </span>
                      <span className="flex-1 text-[15px] leading-snug">{a.text}</span>
                      {state === 'right' && <span className="sr-only">— {t('test.correct')}</span>}
                      {state === 'wrong' && <span className="sr-only">— {t('test.wrong')}</span>}
                      {state === 'picked' && <span className="sr-only">— {t('test.selected')}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {error && <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p>}

            {revealed && (
              <div className="mt-5 space-y-3 motion-safe:animate-fade-up">
                <div className={`rounded-tile border p-4 ${r!.correct ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10'}`} role="status">
                  <p className={`flex items-center gap-2 font-bold ${r!.correct ? 'text-accent-fg' : 'text-danger'}`}>
                    <Icon name={r!.correct ? 'check' : 'close'} size={20} /> {r!.correct ? t('test.correct') : t('test.wrong')}
                  </p>
                  {r!.explanation && <p className="mt-1.5 text-sm text-ink">{r!.explanation}</p>}
                  {r!.ruleRef && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-fg"><Icon name="book" size={14} /> {t('test.rule', { ref: r!.ruleRef })}</p>}
                </div>
                <AiExplain questionId={q.id} />
              </div>
            )}
            <NoteBox q={q} onSaved={(text) => setQs((p) => p.map((x) => (x.id === q.id ? { ...x, note: text } : x)))} />
          </div>
        </article>
      </div>

      {/* Bottom actions */}
      <div className="sticky bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="flex gap-2 px-3 py-3 sm:px-4">
          <button className="btn-secondary w-14 px-0" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} aria-label={t('common.prev')}>
            <Icon name="chevronLeft" />
          </button>
          {idx < qs.length - 1 ? (
            <>
              <button className="btn-primary flex-1" onClick={() => setIdx((i) => i + 1)}>
                {t('common.next')} <Icon name="chevronRight" size={20} />
              </button>
              <button className="btn-ghost px-4" onClick={() => finish()} disabled={finishing}>{t('common.finish')}</button>
            </>
          ) : (
            <button className="btn-success flex-1" onClick={() => finish()} disabled={finishing}>
              <Icon name="check" size={20} /> {finishing ? t('common.loading') : t('common.finish')}
            </button>
          )}
        </div>
      </div>

      <Sheet open={sheet === 'nav'} onClose={() => setSheet(null)} title={t('test.navigator')}>
        <p className="mb-3 text-small text-muted">{t('test.answeredN', { n: answeredCount })} · {t('test.unanswered', { n: unanswered })}</p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
          {qs.map((x, i) => {
            const st = navState(x);
            const cls = { correct: 'bg-success/15 text-accent-fg border-success/50', wrong: 'bg-danger/10 text-danger border-danger/50', answered: 'bg-brand-600 text-white border-brand-600', open: 'bg-raised text-ink border-line' }[st];
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => { setIdx(i); setSheet(null); }}
                className={`num relative grid h-12 place-items-center rounded-xl border text-sm font-bold ${cls} ${i === idx ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-surface' : ''}`}
                aria-label={`${t('test.question', { i: i + 1 })}: ${t(`test.state_${st}` as 'test.state_open')}`}
                aria-current={i === idx ? 'step' : undefined}
              >
                {i + 1}
                {st === 'correct' && <Icon name="check" size={12} className="absolute right-1 top-1" />}
                {st === 'wrong' && <Icon name="close" size={12} className="absolute right-1 top-1" />}
              </button>
            );
          })}
        </div>
        <div className="mt-5 pb-2">
          <button className="btn-success w-full" onClick={() => finish()} disabled={finishing}><Icon name="check" size={20} /> {t('common.finish')}</button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'confirm'} onClose={() => setSheet(null)} title={t('test.finishTitle')}>
        <p className="text-ink">{t('test.finishConfirm')}</p>
        <p className="mt-2 font-semibold text-warning">{t('test.unanswered', { n: unanswered })}</p>
        <div className="mt-5 grid gap-2 pb-2 sm:grid-cols-2">
          <button className="btn-secondary" onClick={() => setSheet(null)}>{t('test.keepGoing')}</button>
          <button className="btn-primary" onClick={submit} disabled={finishing}>{t('common.finish')}</button>
        </div>
      </Sheet>
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
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl pressable ${q.bookmarked ? 'bg-warning/15 text-warning' : 'text-muted hover:bg-raised hover:text-ink'}`}
      aria-pressed={q.bookmarked}
      aria-label={q.bookmarked ? t('test.bookmarked') : t('test.bookmark')}
      title={q.bookmarked ? t('test.bookmarked') : t('test.bookmark')}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill={q.bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
      </svg>
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
      <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex min-h-[48px] items-center gap-2 text-sm font-medium text-brand-fg hover:underline">
        <Icon name="note" size={18} /> {t('test.note')}
      </button>
    );
  return (
    <div className="mt-4">
      <label htmlFor={`note-${q.id}`} className="label">{t('test.note')}</label>
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
      {saved && <p className="mt-1 text-xs text-accent-fg">{t('common.saved')}</p>}
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
      <div className="rounded-tile border border-brand-500/30 bg-brand-600/10 p-4 text-sm">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-brand-fg"><Icon name="sparkles" size={16} /> {t('test.aiTitle')}</p>
        <p className="whitespace-pre-line">{text}</p>
      </div>
    );
  return (
    <button type="button" onClick={run} disabled={loading} className="btn-secondary btn-sm min-h-[48px]">
      <Icon name="sparkles" size={18} /> {loading ? t('test.aiLoading') : t('test.explainAi')}
    </button>
  );
}
