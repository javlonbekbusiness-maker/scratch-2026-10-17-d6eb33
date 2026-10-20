'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { notifyUser } from '@/lib/notify';

const schema = z.object({
  name: z.string().trim().min(1, 'auth.nameRequired').max(60),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().email('auth.emailInvalid').max(120)]),
});

export async function completeOnboarding(_: unknown, fd: FormData) {
  const user = await requireUser({ allowNotOnboarded: true });
  const parsed = schema.safeParse({ name: fd.get('name'), email: fd.get('email') ?? '' });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email } = parsed.data;
  if (email && (await db.user.findFirst({ where: { email, id: { not: user.id } } }))) return { error: 'auth.emailTaken' };

  // No licence category is asked for: everyone practises on the same shared question pool.
  const updated = await db.user.update({
    where: { id: user.id },
    data: { name, email: email || null, onboarded: true },
  });
  if (!user.onboarded) await notifyUser(updated, 'WELCOME', { name, promo_code: '' });
  redirect('/dashboard');
}
