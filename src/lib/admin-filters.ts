import type { PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';

export type PaymentFilters = { q?: string; status?: string; provider?: string; from?: string; to?: string; promo?: string };

const STATUSES: PaymentStatus[] = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
const PROVIDERS: PaymentProvider[] = ['CLICK', 'PAYME', 'UZUM', 'FREE'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Shared by the payments page and its CSV export so both always show the same rows. Days are Tashkent calendar days. */
export function paymentWhere(f: PaymentFilters): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = {};
  if (f.status && STATUSES.includes(f.status as PaymentStatus)) where.status = f.status as PaymentStatus;
  if (f.provider && PROVIDERS.includes(f.provider as PaymentProvider)) where.provider = f.provider as PaymentProvider;
  const createdAt: Prisma.DateTimeFilter = {};
  if (f.from && DAY.test(f.from)) createdAt.gte = new Date(`${f.from}T00:00:00+05:00`);
  if (f.to && DAY.test(f.to)) createdAt.lt = new Date(new Date(`${f.to}T00:00:00+05:00`).getTime() + 86400_000);
  if (createdAt.gte || createdAt.lt) where.createdAt = createdAt;
  if (f.promo) where.promoCode = { code: f.promo.trim().toUpperCase() };
  const q = f.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, '');
    where.OR = [
      { id: q },
      { providerRef: { contains: q } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
      ...(digits.length >= 4 ? [{ user: { phone: { contains: digits } } }] : []),
    ];
  }
  return where;
}

export function pickPaymentFilters(sp: Record<string, string | undefined> | URLSearchParams): PaymentFilters {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? undefined : sp[k]);
  return { q: get('q'), status: get('status'), provider: get('provider'), from: get('from'), to: get('to'), promo: get('promo') };
}
