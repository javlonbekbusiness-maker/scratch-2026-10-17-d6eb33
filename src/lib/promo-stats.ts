import type { PromoCode } from '@prisma/client';
import { db } from './db';

export type CodeStats = { uses: number; checkouts: number; paid: number; revenueUzs: number; discountUzs: number; buyers: number };
const empty = (): CodeStats => ({ uses: 0, checkouts: 0, paid: 0, revenueUzs: 0, discountUzs: 0, buyers: 0 });

/** Redemptions, checkouts started, paid payments, revenue after discount and discount given — per promo code id. */
export async function statsByCode(codeIds?: string[]) {
  const where = codeIds ? { promoCodeId: { in: codeIds } } : { promoCodeId: { not: null } };
  const [uses, pays, buyers] = await Promise.all([
    db.promoUse.groupBy({ by: ['promoCodeId'], where: codeIds ? { promoCodeId: { in: codeIds } } : {}, _count: true }),
    db.payment.groupBy({ by: ['promoCodeId', 'status'], where, _count: true, _sum: { finalAmountUzs: true, discountUzs: true } }),
    db.payment.groupBy({ by: ['promoCodeId', 'userId'], where: { ...where, status: 'PAID' } }),
  ]);
  const map = new Map<string, CodeStats>();
  const get = (id: string) => map.get(id) ?? (map.set(id, empty()), map.get(id)!);
  for (const u of uses) get(u.promoCodeId).uses = u._count;
  for (const p of pays) {
    if (!p.promoCodeId) continue;
    const s = get(p.promoCodeId);
    s.checkouts += p._count;
    if (p.status === 'PAID') {
      s.paid += p._count;
      s.revenueUzs += p._sum.finalAmountUzs ?? 0;
      s.discountUzs += p._sum.discountUzs ?? 0;
    }
  }
  for (const b of buyers) if (b.promoCodeId) get(b.promoCodeId).buyers++;
  return { get: (id: string) => map.get(id) ?? empty(), all: map };
}

export function sumStats(list: CodeStats[]): CodeStats {
  return list.reduce((a, s) => ({
    uses: a.uses + s.uses, checkouts: a.checkouts + s.checkouts, paid: a.paid + s.paid,
    revenueUzs: a.revenueUzs + s.revenueUzs, discountUzs: a.discountUzs + s.discountUzs, buyers: a.buyers + s.buyers,
  }), empty());
}

export type PromoStatus = 'paused' | 'scheduled' | 'expired' | 'used-up' | 'active';

export function promoStatus(p: Pick<PromoCode, 'isActive' | 'startsAt' | 'endsAt' | 'usageLimit'>, uses: number, now = new Date()): PromoStatus {
  if (!p.isActive) return 'paused';
  if (p.startsAt && p.startsAt > now) return 'scheduled';
  if (p.endsAt && p.endsAt < now) return 'expired';
  if (p.usageLimit != null && uses >= p.usageLimit) return 'used-up';
  return 'active';
}

/** Date → value for <input type="datetime-local"> in Tashkent time (UTC+5). */
export function toTashkentInput(d: Date | null) {
  return d ? new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 16) : '';
}
