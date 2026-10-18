'use client';

import { useActionState, useRef, useState } from 'react';
import { saveMessageTemplate, type MessageFormState } from '../actions';
import { smsSegments } from '@/lib/sms-segments';
import { SAMPLE_VARS } from '@/lib/template-defaults';

const render = (text: string) => text.replace(/\{(\w+)\}/g, (m, k) => SAMPLE_VARS[k] ?? m);

export function MessageEditor(props: {
  templateKey: string;
  channel: 'SMS' | 'EMAIL' | 'PUSH';
  lang: string;
  body: string;
  subject: string;
  approved: boolean;
  vars: string[];
}) {
  const [state, action, pending] = useActionState<MessageFormState, FormData>(saveMessageTemplate, null);
  const [body, setBody] = useState(state?.body ?? props.body);
  const [subject, setSubject] = useState(state?.subject ?? props.subject);
  const ref = useRef<HTMLTextAreaElement>(null);
  const seg = smsSegments(render(body));
  const isSms = props.channel === 'SMS';
  const segLimit = props.templateKey === 'OTP' ? 1 : 2;
  const changedApproved = isSms && props.approved && body.trim() !== props.body.trim();

  const insert = (v: string) => {
    const el = ref.current;
    const token = `{${v}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <form key={state?.attempt ?? 0} action={action} className="space-y-3">
      <input type="hidden" name="key" value={props.templateKey} />
      <input type="hidden" name="channel" value={props.channel} />
      <input type="hidden" name="lang" value={props.lang} />
      {state?.error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300">{state.error}</p>}

      {props.channel === 'EMAIL' && (
        <label className="block">
          <span className="label">Subject</span>
          <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className="input min-h-[40px] rounded-xl px-3 text-sm" />
        </label>
      )}

      <div>
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          <span className="text-sm font-medium">Message</span>
          <span className="text-xs muted">· insert:</span>
          {props.vars.map((v) => (
            <button key={v} type="button" onClick={() => insert(v)} className="chip bg-brand-500/10 font-mono text-brand-700 hover:bg-brand-500/20 dark:text-brand-300">
              {`{${v}}`}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="tpl-body">Message</label>
        <textarea
          id="tpl-body"
          ref={ref}
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={props.channel === 'EMAIL' ? 8 : 4}
          className="input py-2 font-mono text-sm"
        />
      </div>

      {isSms && (
        <p className={`text-xs ${seg.segments > segLimit ? 'font-semibold text-red-600' : 'muted'}`} aria-live="polite">
          {seg.length} characters · {seg.encoding} (limit {seg.limit} per SMS) · <b>{seg.segments} SMS segment{seg.segments > 1 ? 's' : ''}</b> per message
          {seg.encoding === 'UCS-2' && ' — non-Latin characters halve the limit; Latin text is cheaper.'}
          {seg.segments > segLimit && ` — keep it to ${segLimit} segment${segLimit > 1 ? 's' : ''} or fewer.`}
        </p>
      )}

      <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide muted">Preview with sample data</p>
        {props.channel === 'EMAIL' && <p className="mb-2 text-sm font-semibold">{render(subject)}</p>}
        <p className="whitespace-pre-line text-sm" data-testid="preview">{render(body)}</p>
      </div>

      {isSms && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="providerApproved" defaultChecked={props.approved && !changedApproved} className="mt-0.5 h-4 w-4" />
          <span>
            Approved by the SMS provider (Eskiz requires pre-approved texts).
            {changedApproved && <span className="block text-xs text-amber-700">You changed an approved text; it must be approved again before Eskiz will deliver it.</span>}
          </span>
        </label>
      )}

      <button disabled={pending} className="btn-primary btn-sm">{pending ? 'Saving…' : 'Save template'}</button>
    </form>
  );
}
