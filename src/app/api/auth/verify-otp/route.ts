import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { verifyOtp } from '@/lib/otp';
import { createSession } from '@/lib/session';
import { getLocale } from '@/i18n/server';

const schema = z.object({ phone: z.string().max(20), code: z.string().regex(/^\d{6}$/) });

const newReferralCode = () => randomBytes(5).toString('hex').toUpperCase();

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const phone = normalizePhone(parsed.data.phone);
  if (!isValidPhone(phone)) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const r = await verifyOtp(phone, parsed.data.code);
  if (!r.ok) return NextResponse.json(r, { status: r.error === 'locked' ? 429 : 400 });

  let user = await db.user.findUnique({ where: { phone } });
  if (!user) {
    const jar = await cookies();
    const refCode = jar.get('ref')?.value;
    const referrer = refCode ? await db.user.findUnique({ where: { referralCode: refCode } }) : null;
    user = await db.user.create({
      data: {
        phone,
        referralCode: newReferralCode(),
        referredById: referrer?.id,
        consentAt: new Date(),
        locale: await getLocale(),
      },
    });
    jar.delete('ref');
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true, onboarded: user.onboarded, next: user.onboarded ? '/dashboard' : '/onboarding' });
}
