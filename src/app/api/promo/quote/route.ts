import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { quote } from '@/lib/pricing';
import { clientIp, failureLimited, recordFailure } from '@/lib/rate-limit';

const schema = z.object({ planSlug: z.string().max(40), code: z.string().max(40).optional().nullable() });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'input' }, { status: 400 });
  const code = parsed.data.code?.trim() || null;
  const ip = await clientIp();
  const keys = [`promo:u:${user.id}`, `promo:ip:${ip}`];

  // Only wrong codes count toward the limit, so switching plans with a valid code never locks a user out.
  if (code) {
    for (const key of keys) {
      const rl = await failureLimited(key, 10);
      if (rl.limited) return NextResponse.json({ error: 'promoTooMany', retryAfter: rl.retryAfter }, { status: 429 });
    }
  }

  const plan = await db.plan.findFirst({ where: { slug: parsed.data.planSlug, isActive: true } });
  if (!plan) return NextResponse.json({ error: 'plan' }, { status: 404 });
  const deviceId = (await cookies()).get('did')?.value;
  const q = await quote(user, plan, code, deviceId);
  if (q.promoError === 'promoInvalid') await Promise.all(keys.map((k) => recordFailure(k, 600)));
  return NextResponse.json({
    amountUzs: q.amountUzs,
    lines: q.lines,
    discountUzs: q.discountUzs,
    finalAmountUzs: q.finalAmountUzs,
    bonusDays: q.bonusDays,
    promoError: q.promoError,
    promoMinOrderUzs: q.promoMinOrderUzs,
    trialDays: q.trialDays,
    promo: q.promo && { code: q.promo.code, type: q.promo.type, value: q.promo.value },
  });
}
