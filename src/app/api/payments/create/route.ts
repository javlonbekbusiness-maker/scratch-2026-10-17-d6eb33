import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/session';
import { createPayment, PROVIDERS } from '@/lib/payments';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  planSlug: z.string().max(40),
  provider: z.enum(PROVIDERS),
  code: z.string().max(40).optional().nullable(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'input' }, { status: 400 });
  const rl = await rateLimit(`pay:${user.id}`, 10, 600);
  if (!rl.ok) return NextResponse.json({ error: 'promoTooMany' }, { status: 429 });

  const deviceId = (await cookies()).get('did')?.value;
  const r = await createPayment(user, parsed.data.planSlug, parsed.data.provider, parsed.data.code?.trim() || null, deviceId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r);
}
