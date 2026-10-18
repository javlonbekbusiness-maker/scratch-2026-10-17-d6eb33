import type { Campaign, Plan, PromoCode, User } from '@prisma/client';
import { db } from './db';
import { getSettings } from './settings';
import { hasPaid, validatePromo, type PromoError } from './promo';

export type DiscountLine = {
  source: 'REFERRAL' | 'WELCOME' | 'CAMPAIGN' | 'PROMO';
  label: string;
  code?: string;
  pct?: number;
  amountUzs: number;
};

export type Quote = {
  plan: Plan;
  amountUzs: number;
  lines: DiscountLine[];
  discountUzs: number;
  finalAmountUzs: number;
  bonusDays: number;
  promo: PromoCode | null;
  promoError: PromoError | null;
  promoMinOrderUzs: number | null;
  campaignId: string | null;
  trialDays: number | null;
};

type QuoteUser = Pick<User, 'id' | 'phone' | 'createdAt' | 'referredById' | 'trialUsedAt'>;

export async function activeCampaigns(now = new Date()) {
  return db.campaign.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
  });
}

/** Welcome offer deadline for a user, or null if not eligible. */
export async function welcomeOffer(user: Pick<User, 'id' | 'createdAt'>, campaigns?: Campaign[]) {
  const list = campaigns ?? (await activeCampaigns());
  const c = list.find((x) => x.type === 'WELCOME');
  if (!c || !c.durationHours) return null;
  const endsAt = new Date(user.createdAt.getTime() + c.durationHours * 3600_000);
  if (endsAt < new Date() || (await hasPaid(user.id))) return null;
  return { campaign: c, endsAt };
}

const appliesTo = (c: Pick<Campaign, 'planSlugs'>, plan: Plan) => !c.planSlugs.length || c.planSlugs.includes(plan.slug);

/**
 * Best automatic discount for a plan: seasonal campaign, welcome offer or referral — never stacked with each other.
 * PARTNER discounts are never automatic; they reach customers only through partner promo codes.
 */
export async function autoDiscount(user: QuoteUser | null, plan: Plan, campaigns?: Campaign[]) {
  const list = campaigns ?? (await activeCampaigns());
  const cands: (DiscountLine & { campaignId?: string })[] = [];
  for (const c of list) {
    if (c.type === 'SEASONAL' && appliesTo(c, plan))
      cands.push({ source: 'CAMPAIGN', label: c.name, pct: c.discountPct, amountUzs: 0, campaignId: c.id });
  }
  if (user) {
    const w = await welcomeOffer(user, list);
    if (w && appliesTo(w.campaign, plan))
      cands.push({ source: 'WELCOME', label: w.campaign.name, pct: w.campaign.discountPct, amountUzs: 0, campaignId: w.campaign.id });
    if (user.referredById && !(await hasPaid(user.id))) {
      const refCampaign = list.find((c) => c.type === 'REFERRAL');
      const pct = refCampaign?.discountPct ?? (await getSettings()).referralFriendPct;
      cands.push({ source: 'REFERRAL', label: 'Referral', pct, amountUzs: 0, campaignId: refCampaign?.id });
    }
  }
  const best = cands.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
  if (!best) return null;
  best.amountUzs = roundDown(plan.priceUzs * (best.pct! / 100));
  return best;
}

const roundDown = (n: number) => Math.floor(n / 100) * 100;

export async function quote(user: QuoteUser, plan: Plan, code?: string | null, deviceId?: string, excludePaymentId?: string): Promise<Quote> {
  const base = plan.priceUzs;
  const auto = await autoDiscount(user, plan);
  let lines: DiscountLine[] = [];
  let promo: PromoCode | null = null;
  let promoError: PromoError | null = null;
  let promoMinOrderUzs: number | null = null;
  let bonusDays = 0;
  let trialDays: number | null = null;
  let campaignId = auto?.campaignId ?? null;

  if (auto) lines.push({ source: auto.source, label: auto.label, pct: auto.pct, amountUzs: auto.amountUzs });

  if (code) {
    const v = await validatePromo(code, user, { planSlug: plan.slug, amountUzs: base, deviceId, excludePaymentId });
    if (!v.ok) {
      promoError = v.error;
      promoMinOrderUzs = v.promo?.minOrderUzs ?? null;
    } else if (v.promo.type === 'FREE_TRIAL') trialDays = v.promo.value;
    else {
      promo = v.promo;
      if (!promo.combinable) {
        lines = [];
        campaignId = null;
      }
      const remaining = base - lines.reduce((s, l) => s + l.amountUzs, 0);
      if (promo.type === 'PERCENT') {
        lines.push({ source: 'PROMO', label: promo.code, code: promo.code, pct: promo.value, amountUzs: roundDown(remaining * (promo.value / 100)) });
      } else if (promo.type === 'FIXED') {
        lines.push({ source: 'PROMO', label: promo.code, code: promo.code, amountUzs: Math.min(remaining, promo.value) });
      } else if (promo.type === 'FREE_DAYS') {
        bonusDays = promo.value;
      }
    }
  }

  const discountUzs = Math.min(base, lines.reduce((s, l) => s + l.amountUzs, 0));
  return {
    plan,
    amountUzs: base,
    lines,
    discountUzs,
    finalAmountUzs: base - discountUzs,
    bonusDays,
    promo,
    promoError,
    promoMinOrderUzs,
    campaignId,
    trialDays,
  };
}

/** "Save X%" versus buying the 1-week plan repeatedly. */
export function savingVsWeekly(plan: Plan, weekly: Plan | undefined) {
  if (!weekly || plan.id === weekly.id || plan.untilPass) return 0;
  const equivalent = (plan.durationDays / weekly.durationDays) * weekly.priceUzs;
  return Math.max(0, Math.round((1 - plan.priceUzs / equivalent) * 100));
}
