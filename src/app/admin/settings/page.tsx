import { requireAdmin } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { isSandbox } from '@/lib/payments';
import { saveSettings } from '../actions';
import { Badge, PageHeader } from '../ui';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, [string, boolean]> = {
  saved: ['Settings saved.', true],
  'bad-pct': ['Friend discount must be 0–90%.', false],
  'bad-days': ['Referrer reward must be 0–365 days.', false],
  'bad-phone': ['Enter a valid support phone number.', false],
  'bad-email': ['Enter a valid support email.', false],
  'bad-free': ['Free questions per topic must be 0–20.', false],
  'bad-telegram':['Telegram username: 5–32 letters, digits or _ (with or without @).', false],
};

const inp = 'input min-h-[40px] rounded-xl px-3 text-sm';

/** Shows whether an integration is configured, without revealing any secret values. */
function envStatus() {
  const has = (k: string) => !!process.env[k];
  return [
    { name: 'Database', ok: has('DATABASE_URL'), note: 'DATABASE_URL' },
    { name: 'Redis (OTP & rate limits)', ok: has('REDIS_URL'), note: has('REDIS_URL') ? 'REDIS_URL' : 'in-memory fallback — set REDIS_URL in production' },
    { name: 'SMS provider', ok: (process.env.SMS_PROVIDER ?? 'mock') !== 'mock', note: `SMS_PROVIDER=${process.env.SMS_PROVIDER ?? 'mock'}` },
    { name: 'Email (SMTP)', ok: has('SMTP_HOST'), note: has('SMTP_HOST') ? 'SMTP_HOST' : 'not set — emails are logged to the console' },
    { name: 'Payments', ok: !isSandbox(), note: isSandbox() ? 'sandbox mode (PAYMENTS_SANDBOX)' : 'live' },
    { name: 'Click', ok: has('CLICK_SECRET_KEY'), note: 'CLICK_* keys' },
    { name: 'Payme', ok: has('PAYME_SECRET_KEY') || has('PAYME_TEST_KEY'), note: 'PAYME_* keys' },
    { name: 'Uzum', ok: has('UZUM_SECRET_KEY'), note: 'UZUM_* keys (stub)' },
    { name: 'AI explainer', ok: has('ANTHROPIC_API_KEY'), note: has('ANTHROPIC_API_KEY') ? `model ${process.env.AI_MODEL ?? 'claude-opus-5-5'}` : 'not set — stored explanation shown' },
    { name: 'Reminders job', ok: has('CRON_SECRET'), note: 'CRON_SECRET; call GET /api/cron/reminders hourly' },
    { name: 'Session secret', ok: has('SESSION_SECRET') && process.env.SESSION_SECRET !== 'change-me', note: 'SESSION_SECRET' },
  ];
}

export default async function SettingsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  const msg = sp.msg ? MESSAGES[sp.msg] : undefined;

  return (
    <>
      <PageHeader title="Settings" desc="Site-wide values. Secrets and provider keys live in environment variables, not here." />
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${msg[1] ? 'bg-mint-500/10 text-mint-700' : 'bg-red-500/10 text-red-700'}`}>{msg[0]}</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <form action={saveSettings} className="card space-y-5 p-5">
          <fieldset className="space-y-3">
            <legend className="font-bold">Referral programme</legend>
            <p className="text-sm muted">Shown on the profile page. An active “Referral reward” campaign overrides the friend discount.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="label">Friend’s discount on first purchase (%)</span><input name="referralFriendPct" type="number" min={0} max={90} required defaultValue={s.referralFriendPct} className={inp} /></label>
              <label className="block"><span className="label">Referrer’s reward (free days)</span><input name="referralRewardDays" type="number" min={0} max={365} required defaultValue={s.referralRewardDays} className={inp} /></label>
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="font-bold">Support contacts</legend>
            <p className="text-sm muted">Shown in the site footer.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="label">Phone</span><input name="supportPhone" required defaultValue={s.supportPhone} className={inp} /></label>
              <label className="block"><span className="label">Email</span><input name="supportEmail" type="email" required defaultValue={s.supportEmail} className={inp} /></label>
              <label className="block"><span className="label">Telegram</span><input name="telegram" defaultValue={s.telegram} placeholder="@yhqtest_support" className={inp} /></label>
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="font-bold">Free access</legend>
            <p className="text-sm muted">Free users can try this many questions of every topic, then see the paywall. 0 makes topics subscriber-only.</p>
            <label className="block max-w-xs"><span className="label">Free questions per topic</span><input name="freeTopicQuestions" type="number" min={0} max={20} required defaultValue={s.freeTopicQuestions} className={inp} /></label>
          </fieldset>
          <button className="btn-primary btn-sm">Save settings</button>
        </form>

        <section className="card p-5" aria-labelledby="env-h">
          <h2 id="env-h" className="font-bold">Integrations</h2>
          <p className="mb-3 text-sm muted">Configured through environment variables (see README and .env.example). Values are never shown here.</p>
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {envStatus().map((e) => (
              <li key={e.name} className="flex items-center justify-between gap-3 py-2">
                <span>{e.name}<span className="block text-xs muted">{e.note}</span></span>
                {e.ok ? <Badge tone="green">configured</Badge> : <Badge tone="amber">not configured</Badge>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
