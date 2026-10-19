import Link from 'next/link';
import { db } from '@/lib/db';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { loadTemplate } from '@/lib/notify';
import { smsSegments } from '@/lib/sms-segments';
import { DEFAULT_TEMPLATES, TEMPLATE_INFO, TEMPLATE_KEYS, TEMPLATE_VARS, type TemplateKey } from '@/lib/template-defaults';
import { formatDate } from '@/lib/format';
import { resetMessageTemplate, testSendTemplate } from '../actions';
import { Badge, PageHeader } from '../ui';
import { ConfirmButton } from '../ConfirmButton';
import { MessageEditor } from './MessageEditor';

export const dynamic = 'force-dynamic';

const CHANNELS = ['SMS', 'EMAIL', 'PUSH'] as const;
const LANGS = [
  { id: 'uz', label: 'UZ' },
  { id: 'ru', label: 'RU' },
];

const MESSAGES: Record<string, [string, 'ok' | 'warn' | 'err']> = {
  saved: ['Template saved. It is used for the next message sent.', 'ok'],
  reset: ['Template reset to the built-in default.', 'ok'],
  'sent-sms': ['Test SMS sent to your phone (in development it appears in the server log).', 'ok'],
  'sent-email': ['Test email sent to your address (in development it appears in the server log).', 'ok'],
  'sent-push': ['Test push recorded (push delivery needs VAPID keys; see README).', 'ok'],
  'send-failed': ['The provider rejected the test message; check the server log and provider settings.', 'err'],
  'no-email': ['Your admin account has no email address. Add one in your profile to test emails.', 'warn'],
  'test-limit': ['Too many test sends; wait a few minutes.', 'warn'],
};
const TONE = { ok: 'bg-mint-500/10 text-mint-700', warn: 'bg-amber-100 text-amber-800', err: 'bg-red-500/10 text-red-700' };

function defaultFor(key: TemplateKey, channel: (typeof CHANNELS)[number], lang: string) {
  const d = DEFAULT_TEMPLATES[key][lang === 'ru' ? 'ru' : 'uz'];
  return { body: channel === 'SMS' ? d.sms : channel === 'EMAIL' ? d.email : d.push, subject: d.emailSubject };
}

export default async function MessagesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const key = ((TEMPLATE_KEYS as readonly string[]).includes(sp.key ?? '') ? sp.key : 'OTP') as TemplateKey;
  const channel = (CHANNELS as readonly string[]).includes(sp.channel ?? '') ? (sp.channel as (typeof CHANNELS)[number]) : 'SMS';
  const lang = LANGS.some((l) => l.id === sp.lang) ? sp.lang! : 'uz';

  const [rows, me, sentCounts] = await Promise.all([
    db.messageTemplate.findMany(),
    getCurrentUser(),
    db.messageLog.groupBy({ by: ['key', 'channel'], _count: true, where: { createdAt: { gt: new Date(Date.now() - 30 * 86400_000) } } }),
  ]);
  const stored = new Map(rows.map((r) => [`${r.key}|${r.channel}|${r.lang}`, r]));
  const current = stored.get(`${key}|${channel}|${lang}`);
  const effective = await loadTemplate(key, channel, lang);
  const def = defaultFor(key, channel, lang);
  const msg = sp.msg ? MESSAGES[sp.msg] : undefined;
  const href = (k: string, c: string, l: string) => `/admin/messages?key=${k}&channel=${c}&lang=${encodeURIComponent(l)}`;
  const sent = (k: string, c: string) => sentCounts.find((s) => s.key === k && s.channel === c)?._count ?? 0;

  return (
    <>
      <PageHeader
        title="Message templates"
        desc="SMS, email and push texts in three languages. Placeholders like {name} are filled in when a message is sent."
      />
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${TONE[msg[1]]}`}>{msg[0]}</p>}

      <div className="card mb-6 overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Message</th>{CHANNELS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {TEMPLATE_KEYS.map((k) => (
              <tr key={k} className={k === key ? 'bg-brand-50/50 dark:bg-brand-950/30' : ''}>
                <td>
                  <span className="font-mono text-xs font-bold">{k}</span>
                  <p className="max-w-[16rem] text-xs muted">{TEMPLATE_INFO[k]}</p>
                </td>
                {CHANNELS.map((c) => (
                  <td key={c} className="whitespace-nowrap">
                    <div className="flex gap-1">
                      {LANGS.map((l) => {
                        const row = stored.get(`${k}|${c}|${l.id}`);
                        const active = k === key && c === channel && l.id === lang;
                        const segs = c === 'SMS' ? smsSegments(row?.body ?? defaultFor(k, c, l.id).body).segments : 0;
                        return (
                          <Link
                            key={l.id}
                            href={href(k, c, l.id)}
                            className={`chip ${active ? 'bg-brand-600 text-white' : row ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'border border-dashed border-slate-300 text-slate-500 dark:border-slate-700'}`}
                            title={row ? `Saved ${formatDate(row.updatedAt)}${c === 'SMS' ? ` · ${segs} segment(s)${row.providerApproved ? ' · approved' : ''}` : ''}` : 'Using built-in default'}
                          >
                            {l.label}{c === 'SMS' && row?.providerApproved ? ' ✓' : ''}{segs > 1 ? ` ·${segs}` : ''}
                          </Link>
                        );
                      })}
                    </div>
                    <p className="mt-0.5 text-[11px] muted">{sent(k, c)} sent (30 d)</p>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3 pb-3 text-xs muted">Dashed = built-in default · ✓ = approved by the SMS provider · ·2 = SMS takes 2 segments.</p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[2fr_1fr]" aria-labelledby="edit-h">
        <div className="card p-5">
          <h2 id="edit-h" className="mb-1 text-lg font-bold">
            <span className="font-mono">{key}</span> · {channel} · {LANGS.find((l) => l.id === lang)!.label}
            {!current && <Badge>default</Badge>}
          </h2>
          <p className="mb-4 text-sm muted">{TEMPLATE_INFO[key]}</p>
          <MessageEditor
            key={`${key}|${channel}|${lang}|${current?.updatedAt?.toISOString() ?? 'd'}`}
            templateKey={key}
            channel={channel}
            lang={lang}
            body={effective.body}
            subject={effective.subject}
            approved={!!current?.providerApproved}
            vars={TEMPLATE_VARS[key]}
          />
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold">Test send</h3>
            <p className="mb-3 text-sm muted">
              Sends the <b>saved</b> version with sample data to you ({channel === 'EMAIL' ? me?.email ?? 'no email on your account' : channel === 'SMS' ? me?.phone : 'your account'}).
            </p>
            <form action={testSendTemplate}>
              <input type="hidden" name="key" value={key} /><input type="hidden" name="channel" value={channel} /><input type="hidden" name="lang" value={lang} />
              <button className="btn-secondary btn-sm">Send test {channel.toLowerCase()}</button>
            </form>
          </div>
          <div className="card p-5">
            <h3 className="font-bold">Built-in default</h3>
            {channel === 'EMAIL' && <p className="mt-2 text-sm font-semibold">{def.subject}</p>}
            <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 p-3 font-mono text-xs dark:bg-slate-800">{def.body}</p>
            {current && (
              <form action={resetMessageTemplate} className="mt-3">
                <input type="hidden" name="key" value={key} /><input type="hidden" name="channel" value={channel} /><input type="hidden" name="lang" value={lang} />
                <ConfirmButton message="Discard your text and use the built-in default?" className="btn-ghost btn-sm text-red-600">Reset to default</ConfirmButton>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
