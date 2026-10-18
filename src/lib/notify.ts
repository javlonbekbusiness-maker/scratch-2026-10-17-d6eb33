import type { MessageChannel } from '@prisma/client';
import { db } from './db';
import { smsProvider } from './sms';
import { sendEmail } from './email';
import { DEFAULT_TEMPLATES, type TemplateKey } from './template-defaults';
import { latinToCyrillic } from './translit';

export function renderTemplate(body: string, vars: Record<string, string | number | undefined>) {
  return body.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

export async function loadTemplate(key: TemplateKey, channel: MessageChannel, lang: string) {
  const row =
    (await db.messageTemplate.findUnique({ where: { key_channel_lang: { key, channel, lang } } })) ??
    (await db.messageTemplate.findUnique({ where: { key_channel_lang: { key, channel, lang: 'uz' } } }));
  if (row) return { subject: row.subject ?? '', body: row.body };
  const d = DEFAULT_TEMPLATES[key][lang === 'ru' ? 'ru' : 'uz'];
  const body = channel === 'SMS' ? d.sms : channel === 'EMAIL' ? d.email : d.push;
  const conv = lang === 'uz-Cyrl' && channel !== 'SMS' ? latinToCyrillic : (s: string) => s;
  return { subject: conv(d.emailSubject), body: conv(body) };
}

type SendArgs = {
  key: TemplateKey;
  channel: MessageChannel;
  to: string;
  lang: string;
  vars: Record<string, string | number | undefined>;
  userId?: string;
};

export async function sendMessage({ key, channel, to, lang, vars, userId }: SendArgs) {
  const tpl = await loadTemplate(key, channel, lang);
  const body = renderTemplate(tpl.body, vars);
  let ok = false;
  if (channel === 'SMS') ok = (await smsProvider().send(to, body)).ok;
  else if (channel === 'EMAIL') ok = (await sendEmail(to, renderTemplate(tpl.subject, vars), body)).ok;
  else {
    // Web push delivery needs VAPID keys and the web-push package; logged until configured.
    console.log(`🔔 [Push stub] → ${userId}: ${body}`);
    ok = true;
  }
  await db.messageLog.create({
    data: { userId, to, channel, key, body: key === 'OTP' ? '[redacted]' : body, status: ok ? 'SENT' : 'FAILED' },
  });
  return ok;
}

/** Sends over every channel the user allows. */
export async function notifyUser(
  user: { id: string; phone: string; email: string | null; locale: string; remindSms: boolean; remindEmail: boolean; remindPush: boolean },
  key: TemplateKey,
  vars: Record<string, string | number | undefined>,
  opts: { force?: boolean } = {},
) {
  const jobs: Promise<boolean>[] = [];
  if (opts.force || user.remindSms) jobs.push(sendMessage({ key, channel: 'SMS', to: user.phone, lang: user.locale, vars, userId: user.id }));
  if (user.email && (opts.force || user.remindEmail))
    jobs.push(sendMessage({ key, channel: 'EMAIL', to: user.email, lang: user.locale, vars, userId: user.id }));
  if (user.remindPush) jobs.push(sendMessage({ key, channel: 'PUSH', to: user.id, lang: user.locale, vars, userId: user.id }));
  await Promise.allSettled(jobs);
}
