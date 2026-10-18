/**
 * SMS providers. SMS_PROVIDER=mock prints messages to the server console.
 * Eskiz and PlayMobile request shapes follow their public API docs; confirm the
 * endpoints and your approved sender name with the provider before going live.
 */
export interface SmsProvider {
  send(phone: string, text: string): Promise<{ ok: boolean; ref?: string; error?: string }>;
}

const mock: SmsProvider = {
  async send(phone, text) {
    console.log(`\n📱 [SMS mock] → ${phone}\n${text}\n`);
    return { ok: true, ref: 'mock-' + Date.now() };
  },
};

let eskizToken: { token: string; exp: number } | null = null;

const eskiz: SmsProvider = {
  async send(phone, text) {
    const base = 'https://notify.eskiz.uz/api';
    if (!eskizToken || eskizToken.exp < Date.now()) {
      const form = new FormData();
      form.set('email', process.env.ESKIZ_EMAIL ?? '');
      form.set('password', process.env.ESKIZ_PASSWORD ?? '');
      const r = await fetch(`${base}/auth/login`, { method: 'POST', body: form });
      if (!r.ok) return { ok: false, error: `eskiz auth ${r.status}` };
      const j = await r.json();
      eskizToken = { token: j.data.token, exp: Date.now() + 25 * 24 * 3600 * 1000 };
    }
    const form = new FormData();
    form.set('mobile_phone', phone.replace('+', ''));
    form.set('message', text);
    form.set('from', process.env.ESKIZ_FROM ?? '4546');
    const r = await fetch(`${base}/message/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${eskizToken.token}` },
      body: form,
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, ref: j.id } : { ok: false, error: j.message ?? `eskiz ${r.status}` };
  },
};

const playmobile: SmsProvider = {
  async send(phone, text) {
    const auth = Buffer.from(`${process.env.PLAYMOBILE_LOGIN}:${process.env.PLAYMOBILE_PASSWORD}`).toString('base64');
    const id = 'yhq' + Date.now();
    const r = await fetch(process.env.PLAYMOBILE_URL ?? 'https://send.smsxabar.uz/broker-api/send', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            recipient: phone.replace('+', ''),
            'message-id': id,
            sms: { originator: process.env.PLAYMOBILE_ORIGINATOR ?? '3700', content: { text } },
          },
        ],
      }),
    });
    return r.ok ? { ok: true, ref: id } : { ok: false, error: `playmobile ${r.status}` };
  },
};

export function smsProvider(): SmsProvider {
  switch (process.env.SMS_PROVIDER) {
    case 'eskiz':
      return eskiz;
    case 'playmobile':
      return playmobile;
    default:
      return mock;
  }
}

export { smsSegments } from './sms-segments';
