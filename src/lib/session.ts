import { createHash, randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { db } from './db';

export const SESSION_COOKIE = 'yhq_session';
const MAX_AGE = 30 * 24 * 3600;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const ua = (await headers()).get('user-agent')?.slice(0, 200);
  await db.authSession.create({
    data: { tokenHash: sha(token), userId, expiresAt: new Date(Date.now() + MAX_AGE * 1000), userAgent: ua },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.authSession.deleteMany({ where: { tokenHash: sha(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Signs the user out everywhere except (optionally) the current browser, e.g. after a password change. */
export async function destroyOtherSessions(userId: string, keepCurrent = true) {
  const token = keepCurrent ? (await cookies()).get(SESSION_COOKIE)?.value : undefined;
  await db.authSession.deleteMany({ where: { userId, ...(token ? { tokenHash: { not: sha(token) } } : {}) } });
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.authSession.findUnique({ where: { tokenHash: sha(token) }, include: { user: true } });
  if (!s) return null;
  if (s.expiresAt < new Date()) {
    // Expired: remove the row so the token can never be revived.
    await db.authSession.deleteMany({ where: { id: s.id } });
    return null;
  }
  return s.user;
});

export async function requireUser(opts: { allowNotOnboarded?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.onboarded && !opts.allowNotOnboarded) redirect('/onboarding');
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') notFound();
  return user;
}
