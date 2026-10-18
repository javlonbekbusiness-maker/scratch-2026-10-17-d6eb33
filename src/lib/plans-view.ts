import type { User } from '@prisma/client';
import { db } from './db';
import { activeCampaigns, autoDiscount, savingVsWeekly } from './pricing';
import { pick, type Locale } from '@/i18n/config';

export type PlanView = {
  id: string;
  slug: string;
  label: string;
  durationDays: number;
  untilPass: boolean;
  priceUzs: number;
  finalUzs: number;
  discountPct: number;
  saving: number;
  featured: boolean;
};

export async function getPlansView(user: User | null, locale: Locale): Promise<PlanView[]> {
  const [plans, campaigns] = await Promise.all([
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    activeCampaigns(),
  ]);
  const weekly = plans.find((p) => p.durationDays === 7 && !p.untilPass);
  return Promise.all(
    plans.map(async (p) => {
      const auto = await autoDiscount(user, p, campaigns);
      return {
        id: p.id,
        slug: p.slug,
        label: pick(p, 'label', locale),
        durationDays: p.durationDays,
        untilPass: p.untilPass,
        priceUzs: p.priceUzs,
        finalUzs: p.priceUzs - (auto?.amountUzs ?? 0),
        discountPct: auto?.pct ?? 0,
        saving: savingVsWeekly(p, weekly),
        featured: p.isFeatured,
      };
    }),
  );
}
