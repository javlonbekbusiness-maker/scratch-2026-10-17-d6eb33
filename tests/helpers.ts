/** Shared helpers for e2e tests that run against `npm run dev` with SMS_PROVIDER=mock. */
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

export const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
export const db = new PrismaClient();
export const RUN_IP = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;

const created: string[] = [];

/** Signs up a throwaway user through the mock OTP flow; returns its id and session token. */
export async function newUser(opts: { prefix?: string; subscribed?: boolean } = {}) {
  const phone = `${opts.prefix ?? '+99896'}${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const post = (path: string, body: unknown) =>
    fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': RUN_IP }, body: JSON.stringify(body) });
  const sent = await post('/api/auth/send-otp', { phone, consent: true });
  assert.equal(sent.status, 200, 'send-otp');
  const { devCode } = await sent.json();
  const ok = await post('/api/auth/verify-otp', { phone, code: devCode });
  const token = /yhq_session=([^;]+)/.exec(ok.headers.get('set-cookie') ?? '')?.[1];
  assert.ok(token, 'session cookie');
  const cat = await db.category.findFirstOrThrow({ where: { code: 'B' } });
  const u = await db.user.update({ where: { phone }, data: { name: 'E2E', onboarded: true, categoryId: cat.id } });
  created.push(u.id);
  if (opts.subscribed) {
    await db.subscription.create({ data: { userId: u.id, startsAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400_000), source: 'TEST' } });
  }
  return { id: u.id, token: token! };
}

export async function cleanup() {
  if (created.length) await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
}

export const page = (path: string, token?: string) =>
  fetch(BASE + path, { redirect: 'manual', headers: { Cookie: `lang=uz${token ? `; yhq_session=${token}` : ''}`, 'X-Forwarded-For': RUN_IP } });
