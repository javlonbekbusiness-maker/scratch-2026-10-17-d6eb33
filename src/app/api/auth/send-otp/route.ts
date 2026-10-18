import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { sendOtp } from '@/lib/otp';
import { clientIp } from '@/lib/rate-limit';
import { getLocale } from '@/i18n/server';

const schema = z.object({ phone: z.string().max(20), consent: z.literal(true) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'consent' }, { status: 400 });
  const phone = normalizePhone(parsed.data.phone);
  if (!isValidPhone(phone)) return NextResponse.json({ error: 'phone' }, { status: 400 });

  const r = await sendOtp(phone, await clientIp(), await getLocale());
  if (!r.ok) return NextResponse.json(r, { status: 429 });
  return NextResponse.json(r);
}
