import type { PromoCode, User } from '@prisma/client';
import { db } from './db';

export type PromoError =
  | 'promoInvalid'
  | 'promoNotStarted'
  | 'promoExpired'
  | 'promoLimit'
  | 'promoUsed'
  | 'promoNotApplicable'
  | 'promoMinOrder'
  | 'promoNewOnly'
  | 'promoTrialUsed';

/** A pending payment holds a code for this long; failed or abandoned ones release it. */
const RESERVATION_MIN = 30;

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export async function hasPaid(userId: string) {
  return (await db.payment.count({ where: { userId, status: 'PAID' } })) > 0;
}

export async function validatePromo(
  rawCode: string,
  user: Pick<User, 'id' | 'phone' | 'trialUsedAt'>,
  ctx: { planSlug?: string; amountUzs?: number; deviceId?: string; excludePaymentId?: string } = {},
): Promise<{ ok: true; promo: PromoCode } | { ok: false; error: PromoError; promo?: PromoCode }> {
  const promo = await db.promoCode.findUnique({ where: { code: normalizeCode(rawCode) } });
  if (!promo || !promo.isActive) return { ok: false, error: 'promoInvalid' };
  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) return { ok: false, error: 'promoNotStarted', promo };
  if (promo.endsAt && promo.endsAt < now) return { ok: false, error: 'promoExpired', promo };

  const reservedSince = new Date(Date.now() - RESERVATION_MIN * 60_000);
  const pendingWhere = {
    promoCodeId: promo.id,
    status: 'PENDING' as const,
    createdAt: { gt: reservedSince },
    ...(ctx.excludePaymentId ? { id: { not: ctx.excludePaymentId } } : {}),
  };

  if (promo.usageLimit != null) {
    const [used, pending] = await Promise.all([
      db.promoUse.count({ where: { promoCodeId: promo.id } }),
      db.payment.count({ where: pendingWhere }),
    ]);
    if (used + pending >= promo.usageLimit) {
      const mine = await db.promoUse.count({ where: { promoCodeId: promo.id, userId: user.id } });
      return { ok: false, error: mine ? 'promoUsed' : 'promoLimit', promo };
    }
  }
  const [mineUsed, minePending] = await Promise.all([
    db.promoUse.count({ where: { promoCodeId: promo.id, userId: user.id } }),
    db.payment.count({ where: { ...pendingWhere, userId: user.id } }),
  ]);
  if (mineUsed + minePending >= promo.perUserLimit) return { ok: false, error: 'promoUsed', promo };

  if (promo.newUsersOnly && (await hasPaid(user.id))) return { ok: false, error: 'promoNewOnly', promo };

  if (promo.type === 'FREE_TRIAL') {
    if (user.trialUsedAt) return { ok: false, error: 'promoTrialUsed', promo };
    const claim = await db.trialClaim.findFirst({
      where: { OR: [{ phone: user.phone }, ...(ctx.deviceId ? [{ deviceId: ctx.deviceId }] : [])] },
    });
    if (claim) return { ok: false, error: 'promoTrialUsed', promo };
    return { ok: true, promo };
  }

  if (ctx.planSlug && promo.planSlugs.length && !promo.planSlugs.includes(ctx.planSlug))
    return { ok: false, error: 'promoNotApplicable', promo };
  if (ctx.amountUzs != null && promo.minOrderUzs && ctx.amountUzs < promo.minOrderUzs)
    return { ok: false, error: 'promoMinOrder', promo };

  return { ok: true, promo };
}

/** Readable promo label, e.g. "−20%", "−15 000 so'm", "+7 kun". */
export function promoValueLabel(p: Pick<PromoCode, 'type' | 'value'>, soum: string, days: string) {
  switch (p.type) {
    case 'PERCENT':
      return `−${p.value}%`;
    case 'FIXED':
      return `−${new Intl.NumberFormat('ru-RU').format(p.value).replace(/ /g, ' ')} ${soum}`;
    default:
      return `+${p.value} ${days}`;
  }
}
