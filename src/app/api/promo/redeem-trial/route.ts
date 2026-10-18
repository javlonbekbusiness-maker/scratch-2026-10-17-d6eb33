import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { validatePromo } from '@/lib/promo';
import { grantDays } from '@/lib/access';
import { clientIp, failureLimited, recordFailure } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const parsed = z.object({ code: z.string().min(1).max(40) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'promoInvalid' }, { status: 400 });

  const ip = await clientIp();
  const keys = [`promo:u:${user.id}`, `promo:ip:${ip}`];
  for (const key of keys) {
    if ((await failureLimited(key, 10)).limited) return NextResponse.json({ error: 'promoTooMany' }, { status: 429 });
  }

  const deviceId = (await cookies()).get('did')?.value ?? 'unknown';
  const v = await validatePromo(parsed.data.code, user, { deviceId });
  if (!v.ok) {
    if (v.error === 'promoInvalid') await Promise.all(keys.map((k) => recordFailure(k, 600)));
    return NextResponse.json({ error: v.error }, { status: 400 });
  }
  if (v.promo.type !== 'FREE_TRIAL') return NextResponse.json({ error: 'promoNotApplicable' }, { status: 400 });

  // Claim first so concurrent requests can't both grant a trial.
  const claimed = await db.user.updateMany({ where: { id: user.id, trialUsedAt: null }, data: { trialUsedAt: new Date() } });
  if (!claimed.count) return NextResponse.json({ error: 'promoTrialUsed' }, { status: 400 });

  await db.trialClaim.create({ data: { phone: user.phone, deviceId } });
  await db.promoUse.create({ data: { promoCodeId: v.promo.id, userId: user.id } });
  const sub = await grantDays(user.id, v.promo.value, 'TRIAL');
  return NextResponse.json({ ok: true, days: v.promo.value, expiresAt: sub.expiresAt });
}
