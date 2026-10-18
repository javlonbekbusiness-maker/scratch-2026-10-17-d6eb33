import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createSession } from '@/lib/session';
import { clientIp, rateLimit } from '@/lib/rate-limit';

const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', 10);
const schema =z.object({ email: z.string().email().max(120), password: z.string().min(1).max(100) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const email = parsed.data.email.toLowerCase();

  const ip = await clientIp();
  for (const key of [`login:ip:${ip}`, `login:email:${email}`]) {
    const rl = await rateLimit(key, 10, 900);
    if (!rl.ok) return NextResponse.json({ error: 'too_many', retryAfter: rl.retryAfter }, { status: 429 });
  }

  const user = await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  // Always run bcrypt so response time doesn't reveal whether the email is registered.
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash) return NextResponse.json({ error: 'invalid' }, { status: 401 });
  if (!user || !ok) return NextResponse.json({ error: 'invalid' }, { status: 401 });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
