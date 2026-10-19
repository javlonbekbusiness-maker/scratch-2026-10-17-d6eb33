import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { finishSession } from '@/lib/tests';
import { FULL_TEST_QUESTIONS, type DailyStatus } from '@/lib/daily-limit';
import { getT } from '@/i18n/server';

const daily = (d: DailyStatus | null) => d && { used: d.used, remaining: d.remaining, limit: d.limit, resetsAt: d.resetsAt.toISOString() };

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const parsed = z.object({ sessionId: z.string().min(1).max(64) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'input' }, { status: 400 });
  const s = await db.testSession.findUnique({ where: { id: parsed.data.sessionId }, select: { userId: true } });
  if (!s || s.userId !== user.id) return NextResponse.json({ error: 'session' }, { status: 404 });

  const { t } = await getT();
  let r;
  try {
    r = await finishSession(parsed.data.sessionId);
  } catch (e) {
    // The transaction rolled back: no result was saved and nothing counted toward the limit.
    console.error('[tests/finish]', e);
    return NextResponse.json({ error: 'server', message: t('common.error') }, { status: 500 });
  }
  if (!r.ok && r.error === 'daily_limit') {
    return NextResponse.json({ error: 'daily_limit', message: t('limit.reached', { max: r.daily.limit }), daily: daily(r.daily) }, { status: 429 });
  }
  if (!r.ok) return NextResponse.json({ error: 'invalid_test', message: t('limit.invalid', { n: FULL_TEST_QUESTIONS }) }, { status: 422 });
  return NextResponse.json({ ok: true, score: r.session.score, passed: r.session.passed, daily: daily(r.daily) });
}
