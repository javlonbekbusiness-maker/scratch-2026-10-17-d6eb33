import type { Payment, PaymentProvider, User } from '@prisma/client';
import { db } from './db';
import { grantDays } from './access';
import { quote } from './pricing';
import { notifyUser } from './notify';
import { getSettings } from './settings';
import { formatDate, formatUzs } from './format';

export const PROVIDERS = ['CLICK', 'PAYME', 'UZUM'] as const;
export const isSandbox = () => process.env.PAYMENTS_SANDBOX !== 'false';
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function createPayment(user: User, planSlug: string, provider: (typeof PROVIDERS)[number], code?: string | null, deviceId?: string) {
  const plan = await db.plan.findFirst({ where: { slug: planSlug, isActive: true } });
  if (!plan) return { ok: false as const, error: 'plan' };
  const q = await quote(user, plan, code, deviceId);
  if (code && q.promoError) return { ok: false as const, error: q.promoError };

  const payment = await db.payment.create({
    data: {
      userId: user.id,
      planId: plan.id,
      provider: q.finalAmountUzs === 0 ? 'FREE' : provider,
      amountUzs: q.amountUzs,
      discountUzs: q.discountUzs,
      finalAmountUzs: q.finalAmountUzs,
      discountLines: q.lines,
      promoCodeId: q.promo?.id,
      campaignId: q.campaignId,
      bonusDays: q.bonusDays,
    },
  });

  if (payment.finalAmountUzs === 0) {
    await fulfillPayment(payment.id, 'free');
    return { ok: true as const, paymentId: payment.id, redirectUrl: `/checkout/result/${payment.id}` };
  }
  return { ok: true as const, paymentId: payment.id, redirectUrl: checkoutUrl(payment) };
}

/** Where to send the user to pay. In sandbox mode every provider goes to our simulator page. */
export function checkoutUrl(p: Payment) {
  if (isSandbox()) return `/checkout/sandbox/${p.id}`;
  const ret = encodeURIComponent(`${appUrl()}/checkout/result/${p.id}`);
  switch (p.provider) {
    case 'CLICK':
      return `https://my.click.uz/services/pay?service_id=${process.env.CLICK_SERVICE_ID}&merchant_id=${process.env.CLICK_MERCHANT_ID}&amount=${p.finalAmountUzs}&transaction_param=${p.id}&return_url=${ret}`;
    case 'PAYME': {
      const params = `m=${process.env.PAYME_MERCHANT_ID};ac.order_id=${p.id};a=${p.finalAmountUzs * 100};c=${appUrl()}/checkout/result/${p.id}`;
      return `https://checkout.paycom.uz/${Buffer.from(params).toString('base64')}`;
    }
    case 'UZUM':
      // Uzum Bank merchant checkout requires a server-side order registration call; see README.
      return `${process.env.UZUM_CHECKOUT_URL ?? ''}?orderId=${p.id}&amount=${p.finalAmountUzs}&returnUrl=${ret}`;
    default:
      return `/checkout/result/${p.id}`;
  }
}

/**
 * Marks a payment paid and grants access. Idempotent: only the first call for a
 * PENDING payment has any effect, so provider retries are safe.
 */
export async function fulfillPayment(paymentId: string, providerRef?: string) {
  const claimed = await db.payment.updateMany({
    where: { id: paymentId, status: 'PENDING' },
    data: { status: 'PAID', paidAt: new Date(), providerRef },
  });
  if (claimed.count === 0) return false;

  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { plan: true, user: true } });
  const sub = await grantDays(p.userId, p.plan.durationDays + p.bonusDays, 'PAYMENT', { planId: p.planId, paymentId: p.id });
  if (p.promoCodeId) await db.promoUse.create({ data: { promoCodeId: p.promoCodeId, userId: p.userId, paymentId: p.id } });

  await rewardReferrer(p.user);

  const planLabel = p.plan.labelUz;
  await notifyUser(
    p.user,
    'RECEIPT',
    { name: p.user.name ?? '', plan: planLabel, amount: formatUzs(p.finalAmountUzs), expiry_date: formatDate(sub.expiresAt) },
    { force: true },
  );
  await db.payment.update({ where: { id: p.id }, data: { receiptSentAt: new Date() } });
  return true;
}

/** Referrer earns free days once per referred phone, after that friend's first successful payment. */
async function rewardReferrer(friend: User) {
  if (!friend.referredById || friend.referredById === friend.id) return;
  const exists = await db.referralReward.findUnique({ where: { friendId: friend.id } });
  if (exists) return;
  const { referralRewardDays } = await getSettings();
  try {
    await db.referralReward.create({ data: { referrerId: friend.referredById, friendId: friend.id, freeDays: referralRewardDays } });
  } catch {
    return; // unique constraint: rewarded concurrently
  }
  await grantDays(friend.referredById, referralRewardDays, 'REFERRAL');
  const referrer = await db.user.findUnique({ where: { id: friend.referredById } });
  if (referrer) await notifyUser(referrer, 'REFERRAL', { name: referrer.name ?? '', days: referralRewardDays });
}

/** Failed payments simply stop holding their promo code (reservations only count PENDING rows). */
export async function failPayment(paymentId: string) {
  await db.payment.updateMany({ where: { id: paymentId, status: 'PENDING' }, data: { status: 'FAILED' } });
}

export const providerLabel: Record<PaymentProvider, string> = { CLICK: 'Click', PAYME: 'Payme', UZUM: 'Uzum', FREE: 'Free' };
