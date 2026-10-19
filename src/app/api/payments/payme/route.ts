import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { failPayment, fulfillPayment } from '@/lib/payments';

/**
 * Payme Merchant API (JSON-RPC). Amounts are in tiyin (1 so'm = 100 tiyin).
 * Minimal implementation of the required methods; run Payme's sandbox test suite
 * against it before going live (it checks states and timings strictly).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Payme params vary per method; each handler reads only the fields it needs
type Rpc = { id: number; method: string; params: Record<string, any> };

const err = (id: number | null, code: number, message: string) =>
  NextResponse.json({ id, error: { code, message: { ru: message, uz: message, en: message } } });

function authorized(req: Request) {
  const key = process.env.PAYMENTS_SANDBOX !== 'false' ? process.env.PAYME_TEST_KEY : process.env.PAYME_SECRET_KEY;
  if (!key) return false;
  const expected = Buffer.from('Basic ' + Buffer.from(`Paycom:${key}`).toString('base64'));
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Rpc | null;
  if (!body) return err(null, -32700, 'Parse error');
  if (!authorized(req)) return err(body.id, -32504, 'Unauthorized');
  const { id, method, params } = body;

  const byOrder = async () => db.payment.findUnique({ where: { id: String(params.account?.order_id ?? '') } });
  const byTx = async () => db.payment.findFirst({ where: { providerRef: `payme:${params.id}` } });
  const state = (s: string) => (s === 'PAID' ? 2 : s === 'FAILED' ? -1 : 1);

  switch (method) {
    case 'CheckPerformTransaction': {
      const p = await byOrder();
      if (!p || p.status !== 'PENDING') return err(id, -31050, 'Order not found');
      if (params.amount !== p.finalAmountUzs * 100) return err(id, -31001, 'Incorrect amount');
      return NextResponse.json({ id, result: { allow: true } });
    }
    case 'CreateTransaction': {
      const existing = await byTx();
      if (existing) return NextResponse.json({ id, result: { create_time: existing.updatedAt.getTime(), transaction: existing.id, state: state(existing.status) } });
      const p = await byOrder();
      if (!p || p.status !== 'PENDING') return err(id, -31050, 'Order not found');
      if (params.amount !== p.finalAmountUzs * 100) return err(id, -31001, 'Incorrect amount');
      if (p.providerRef?.startsWith('payme:')) return err(id, -31050, 'Order has another transaction');
      const u = await db.payment.update({ where: { id: p.id }, data: { providerRef: `payme:${params.id}` } });
      return NextResponse.json({ id, result: { create_time: u.updatedAt.getTime(), transaction: u.id, state: 1 } });
    }
    case 'PerformTransaction': {
      const p = await byTx();
      if (!p) return err(id, -31003, 'Transaction not found');
      if (p.status === 'FAILED') return err(id, -31008, 'Transaction cancelled');
      await fulfillPayment(p.id, `payme:${params.id}`);
      const done = await db.payment.findUniqueOrThrow({ where: { id: p.id } });
      return NextResponse.json({ id, result: { transaction: p.id, perform_time: done.paidAt?.getTime() ?? Date.now(), state: 2 } });
    }
    case 'CancelTransaction': {
      const p = await byTx();
      if (!p) return err(id, -31003, 'Transaction not found');
      if (p.status === 'PAID') return err(id, -31007, 'Cannot cancel a performed transaction');
      await failPayment(p.id);
      return NextResponse.json({ id, result: { transaction: p.id, cancel_time: Date.now(), state: -1 } });
    }
    case 'CheckTransaction': {
      const p = await byTx();
      if (!p) return err(id, -31003, 'Transaction not found');
      return NextResponse.json({
        id,
        result: {
          create_time: p.createdAt.getTime(),
          perform_time: p.paidAt?.getTime() ?? 0,
          cancel_time: p.status === 'FAILED' ? p.updatedAt.getTime() : 0,
          transaction: p.id,
          state: state(p.status),
          reason: p.status === 'FAILED' ? 3 : null,
        },
      });
    }
    case 'GetStatement':
      return NextResponse.json({ id, result: { transactions: [] } });
    default:
      return err(id, -32601, 'Method not found');
  }
}
