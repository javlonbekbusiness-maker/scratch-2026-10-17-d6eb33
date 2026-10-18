'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';

export type PreviewData = {
  text: string;
  imageUrl: string | null;
  answers: { id: string; text: string }[];
  correctId: string;
  explanation: string;
  ruleRef: string | null;
};

export function PreviewQuestion({ q }: { q: PreviewData }) {
  const { t } = useT();
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="card overflow-hidden">
      {q.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.imageUrl} alt="" width={640} height={360} loading="lazy" className="aspect-video w-full bg-slate-100 object-contain dark:bg-slate-800" />
      )}
      <div className="p-5">
        <p className="text-lg font-semibold">{q.text}</p>
        <ul className="mt-4 space-y-2">
          {q.answers.map((a, i) => {
            const state = picked ? (a.id === q.correctId ? 'ok' : a.id === picked ? 'bad' : 'idle') : 'idle';
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={!!picked}
                  onClick={() => setPicked(a.id)}
                  className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                    state === 'ok'
                      ? 'animate-pop border-mint-500 bg-mint-50 dark:bg-mint-900/30'
                      : state === 'bad'
                        ? 'animate-shake border-red-400 bg-red-50 dark:bg-red-900/30'
                        : 'border-slate-200 hover:border-brand-400 dark:border-slate-700'
                  }`}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold dark:bg-slate-800">{i + 1}</span>
                  {a.text}
                </button>
              </li>
            );
          })}
        </ul>
        {picked && (
          <div className="mt-4 animate-fade-up rounded-2xl bg-brand-50 p-4 text-sm dark:bg-brand-950">
            <p className="font-semibold">{picked === q.correctId ? `✅ ${t('test.correct')}` : `❌ ${t('test.wrong')}`}</p>
            <p className="mt-1">{q.explanation}</p>
            {q.ruleRef && <p className="mt-2 text-xs font-semibold text-brand-700 dark:text-brand-300">{t('test.rule', { ref: q.ruleRef })}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
