import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { toCsv } from '@/lib/csv';
import { paymentWhere, pickPaymentFilters } from '@/lib/admin-filters';

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== 'ADMIN') return new Response('Not found', { status: 404 });
  const { kind } = await params;
  const url = new URL(req.url);
  let body = '';

  if (kind === 'promo') {
    const batch = url.searchParams.get('batch');
    const codes = await db.promoCode.findMany({ where: batch ? { batchId: batch } : {}, include: { partner: true, _count: { select: { uses: true } } }, orderBy: { createdAt: 'desc' } });
    body = toCsv(
      codes.map((c) => ({
        code: c.code, type: c.type, value: c.value, starts_at: c.startsAt?.toISOString() ?? '', ends_at: c.endsAt?.toISOString() ?? '',
        usage_limit: c.usageLimit ?? '', per_user_limit: c.perUserLimit, plan_slugs: c.planSlugs.join('|'), active: c.isActive,
        uses: c._count.uses, partner: c.partner?.name ?? '', batch: c.batchId ?? '', note: c.note ?? '',
      })),
    );
  } else if (kind === 'users') {
    const users = await db.user.findMany({ include: { category: true }, orderBy: { createdAt: 'desc' } });
    body = toCsv(users.map((u) => ({ phone: u.phone, name: u.name ?? '', email: u.email ?? '', category: u.category?.code ?? '', role: u.role, created_at: u.createdAt.toISOString() })));
  } else if (kind === 'payments') {
    const pays = await db.payment.findMany({
      where: paymentWhere(pickPaymentFilters(url.searchParams)),
      include: { user: true, plan: true, promoCode: true, campaign: true },
      orderBy: { createdAt: 'desc' },
    });
    body = toCsv(
      pays.map((p) => ({
        id: p.id, created_at: p.createdAt.toISOString(), paid_at: p.paidAt?.toISOString() ?? '', phone: p.user.phone, name: p.user.name ?? '',
        plan: p.plan.slug, provider: p.provider, status: p.status, amount_uzs: p.amountUzs, discount_uzs: p.discountUzs, final_uzs: p.finalAmountUzs,
        promo: p.promoCode?.code ?? '', campaign: p.campaign?.name ?? '', bonus_days: p.bonusDays, provider_ref: p.providerRef ?? '',
      })),
    );
  } else return new Response('Not found', { status: 404 });

  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${kind}-${Date.now()}.csv"` } });
}
