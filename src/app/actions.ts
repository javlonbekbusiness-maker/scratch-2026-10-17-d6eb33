'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { TestMode } from '@prisma/client';
import { db } from '@/lib/db';
import { destroySession, getCurrentUser, requireUser } from '@/lib/session';
import { LOCALE_COOKIE, isLocale } from '@/i18n/config';
import { startTest } from '@/lib/tests';

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: 365 * 86400, sameSite: 'lax' });
  const user = await getCurrentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath('/', 'layout');
}

export async function logout() {
  await destroySession();
  redirect('/');
}

export async function startTestAction(formData: FormData) {
  const user = await requireUser();
  const mode = String(formData.get('mode')) as TestMode;
  const ticket = formData.get('ticket') ? Number(formData.get('ticket')) : undefined;
  const topic = formData.get('topic') ? String(formData.get('topic')) : undefined;
  const r = await startTest(user, { mode, ticket, topic });
  if (r.ok) redirect(`/test/${r.sessionId}`);
  if (r.error === 'locked') redirect(`/tests?locked=1`);
  if (r.error === 'category') redirect('/onboarding');
  redirect(`/tests?empty=1`);
}

export async function setCategory(formData: FormData) {
  const user = await requireUser();
  const categoryId = String(formData.get('categoryId'));
  if (await db.category.findUnique({ where: { id: categoryId } })) {
    await db.user.update({ where: { id: user.id }, data: { categoryId } });
  }
  revalidatePath('/tests');
}

export async function toggleBookmark(questionId: string) {
  const user = await requireUser();
  const key = { userId_questionId: { userId: user.id, questionId } };
  const existing = await db.bookmark.findUnique({ where: key });
  if (existing) await db.bookmark.delete({ where: key });
  else await db.bookmark.create({ data: { userId: user.id, questionId } });
  return !existing;
}

export async function saveNote(questionId: string, text: string) {
  const user = await requireUser();
  const clean = text.slice(0, 2000).trim();
  const key = { userId_questionId: { userId: user.id, questionId } };
  if (!clean) await db.note.deleteMany({ where: { userId: user.id, questionId } });
  else await db.note.upsert({ where: key, create: { userId: user.id, questionId, text: clean }, update: { text: clean } });
  return true;
}

const profileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.union([z.literal(''), z.string().trim().email().max(120)]),
  categoryId: z.string().min(1),
  password: z.string().max(100).optional(),
  remindSms: z.boolean(),
  remindEmail: z.boolean(),
  remindPush: z.boolean(),
  leaderboardOptIn: z.boolean(),
});

export async function updateProfile(_: unknown, formData: FormData) {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email') ?? '',
    categoryId: formData.get('categoryId'),
    password: formData.get('password') || undefined,
    remindSms: formData.get('remindSms') === 'on',
    remindEmail: formData.get('remindEmail') === 'on',
    remindPush: formData.get('remindPush') === 'on',
    leaderboardOptIn: formData.get('leaderboardOptIn') === 'on',
  });
  if (!parsed.success) return { ok: false, error: 'common.error' };
  const d = parsed.data;
  if (d.email) {
    const taken = await db.user.findFirst({ where: { email: d.email, id: { not: user.id } } });
    if (taken) return { ok: false, error: 'auth.emailTaken' };
  }
  if (d.password && d.password.length < 8) return { ok: false, error: 'common.error' };
  await db.user.update({
    where: { id: user.id },
    data: {
      name: d.name,
      email: d.email || null,
      categoryId: d.categoryId,
      remindSms: d.remindSms,
      remindEmail: d.remindEmail,
      remindPush: d.remindPush,
      leaderboardOptIn: d.leaderboardOptIn,
      nickname: user.nickname ?? `Haydovchi #${Math.floor(1000 + Math.random() * 9000)}`,
      ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
    },
  });
  revalidatePath('/profile');
  return { ok: true, error: null };
}

export async function markPassed() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { passedAt: new Date() } });
  // "Until you pass" access ends once the user reports passing.
  await db.subscription.updateMany({
    where: { userId: user.id, expiresAt: { gt: new Date() }, plan: { untilPass: true } },
    data: { expiresAt: new Date() },
  });
  revalidatePath('/profile');
}
