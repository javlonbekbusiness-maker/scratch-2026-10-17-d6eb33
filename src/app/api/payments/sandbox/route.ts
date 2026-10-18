import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { failPayment, fulfillPayment, isSandbox } from '@/lib/payments';

/** Simulated provider callback; disabled unless PAYMENTS_SANDBOX is on. */
export async function POST(req: Request) {
  if (!isSandbox()) return NextResponse.json({ error: 'disabled' }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const parsed = z.object({ paymentId: z.string(), outcome: z.enum(['success', 'fail']) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'input' }, { status: 400 });
  const p = await db.payment.findUnique({ where: { id: parsed.data.paymentId } });
  if (!p || p.userId !== user.id) return NextResponse.json({ error: 'payment' }, { status: 404 });

  if (parsed.data.outcome === 'success') await fulfillPayment(p.id, `sandbox-${Date.now()}`);
  else await failPayment(p.id);
  return NextResponse.json({ ok: true });
}
