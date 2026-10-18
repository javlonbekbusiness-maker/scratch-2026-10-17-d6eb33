import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { failPayment, fulfillPayment } from '@/lib/payments';

/**
 * Uzum Bank merchant callback — STUB. Uzum's merchant API (check / create /
 * confirm / reverse / status) is issued with the merchant contract; replace the
 * body shape and signature check here with theirs. Until then, callers must send
 * the shared secret in the X-Uzum-Secret header.
 */
const schema = z.object({ orderId: z.string(), amount: z.number(), status: z.enum(['CONFIRMED', 'FAILED']), transactionId: z.string() });

export async function POST(req: Request) {
  const secret = process.env.UZUM_SECRET_KEY;
  const given = req.headers.get('x-uzum-secret') ?? '';
  if (!secret || secret.length !== given.length || !timingSafeEqual(Buffer.from(secret), Buffer.from(given))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'input' }, { status: 400 });
  const p = await db.payment.findUnique({ where: { id: parsed.data.orderId } });
  if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (parsed.data.amount !== p.finalAmountUzs) return NextResponse.json({ error: 'amount' }, { status: 400 });

  if (parsed.data.status === 'CONFIRMED') await fulfillPayment(p.id, `uzum:${parsed.data.transactionId}`);
  else await failPayment(p.id);
  return NextResponse.json({ ok: true });
}
