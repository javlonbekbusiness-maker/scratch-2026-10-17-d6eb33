import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { finishSession } from '@/lib/tests';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const parsed = z.object({ sessionId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'input' }, { status: 400 });
  const s = await db.testSession.findUnique({ where: { id: parsed.data.sessionId }, select: { userId: true } });
  if (!s || s.userId !== user.id) return NextResponse.json({ error: 'session' }, { status: 404 });
  const done = await finishSession(parsed.data.sessionId);
  return NextResponse.json({ ok: true, score: done.score, passed: done.passed });
}
