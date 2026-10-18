import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { failPayment, fulfillPayment } from '@/lib/payments';

/**
 * Click SHOP API callback (Prepare action=0, Complete action=1).
 * Configure this URL for both actions in the Click merchant cabinet.
 * Verify field names and error codes against the current Click docs before going live.
 */
export async function POST(req: Request) {
  const f = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  const action = f.action;
  const md5 = (s: string) => createHash('md5').update(s).digest('hex');
  const expected = md5(
    f.click_trans_id + f.service_id + (process.env.CLICK_SECRET_KEY ?? '') + f.merchant_trans_id + (action === '1' ? f.merchant_prepare_id : '') + f.amount + action + f.sign_time,
  );
  const reply = (error: number, error_note: string) =>
    NextResponse.json({
      click_trans_id: f.click_trans_id,
      merchant_trans_id: f.merchant_trans_id,
      [action === '1' ? 'merchant_confirm_id' : 'merchant_prepare_id']: f.merchant_trans_id,
      error,
      error_note,
    });

  if (!process.env.CLICK_SECRET_KEY || expected !== f.sign_string) return reply(-1, 'SIGN CHECK FAILED');
  const p = await db.payment.findUnique({ where: { id: f.merchant_trans_id } });
  if (!p) return reply(-5, 'Order not found');
  if (Math.round(Number(f.amount)) !== p.finalAmountUzs) return reply(-2, 'Incorrect amount');
  if (p.status === 'PAID') return reply(-4, 'Already paid');
  if (p.status === 'FAILED') return reply(-9, 'Transaction cancelled');

  if (action === '0') return reply(0, 'Success');
  if (Number(f.error) < 0) {
    await failPayment(p.id);
    return reply(-9, 'Transaction cancelled');
  }
  await fulfillPayment(p.id, `click:${f.click_trans_id}`);
  return reply(0, 'Success');
}
