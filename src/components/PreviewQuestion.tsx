'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';
import { Icon } from './ui/Icon';

export type PreviewData = {
  text: string;
  imageUrl: string | null;
  answers: { id: string; text: string }[];
  correctId: string;
  explanation: string;
  ruleRef: string | null;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** Try-it question on the landing page, using the same answer states as the real test screen. */
export function PreviewQuestion({ q }: { q: PreviewData }) {
  const { t } = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const ok = picked === q.correctId;
  return (
    <div className="card overflow-hidden">
      {q.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.imageUrl} alt="" width={640} height={360} loading="lazy" decoding="async" className="aspect-video w-full bg-raised object-contain" />
      )}
      <div className="p-5">
        <p className="text-[18px] font-semibold leading-snug">{q.text}</p>
        <ul className="mt-4 space-y-2.5">
          {q.answers.map((a, i) => {
            const state = picked ? (a.id === q.correctId ? 'right' : a.id === picked ? 'wrong' : 'dim') : 'idle';
            const cls = {
              idle: 'border-line bg-raised hover:border-brand-500/50',
              right: 'border-success bg-success/10 motion-safe:animate-pop',
              wrong: 'border-danger bg-danger/10 motion-safe:animate-shake',
              dim: 'border-line bg-raised opacity-60',
            }[state];
            const badge = { idle: 'bg-surface text-muted', right: 'bg-success text-white dark:text-canvas', wrong: 'bg-danger text-white dark:text-canvas', dim: 'bg-surface text-muted' }[state];
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={!!picked}
                  onClick={() => setPicked(a.id)}
                  className={`flex min-h-[56px] w-full items-center gap-3 rounded-tile border-2 px-3 py-3 text-left transition ${cls}`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${badge}`} aria-hidden>
                    {state === 'right' ? <Icon name="check" size={18} /> : state === 'wrong' ? <Icon name="close" size={18} /> : LETTERS[i]}
                  </span>
                  <span className="flex-1">{a.text}</span>
                  {state === 'right' && <span className="sr-only">— {t('test.correct')}</span>}
                  {state === 'wrong' && <span className="sr-only">— {t('test.wrong')}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {picked && (
          <div className={`mt-4 rounded-tile border p-4 text-sm motion-safe:animate-fade-up ${ok ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10'}`} role="status">
            <p className={`flex items-center gap-2 font-bold ${ok ? 'text-accent-fg' : 'text-danger'}`}>
              <Icon name={ok ? 'check' : 'close'} size={18} /> {ok ? t('test.correct') : t('test.wrong')}
            </p>
            <p className="mt-1">{q.explanation}</p>
            {q.ruleRef && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-fg"><Icon name="book" size={14} /> {t('test.rule', { ref: q.ruleRef })}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
