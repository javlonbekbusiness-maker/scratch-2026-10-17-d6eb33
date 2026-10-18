import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { recordReview } from '@/lib/srs';
import { isPracticeMode } from '@/lib/tests';
import { getLocale } from '@/i18n/server';
import { pick } from '@/i18n/config';

const schema = z.object({ sessionId: z.string().min(1), questionId: z.string().min(1), answerId: z.string().min(1) });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'input' }, { status: 400 });
  const { sessionId, questionId, answerId } = parsed.data;

  const s = await db.testSession.findUnique({ where: { id: sessionId } });
  if (!s || s.userId !== user.id || s.finishedAt || !s.questionIds.includes(questionId)) {
    return NextResponse.json({ error: 'session' }, { status: 400 });
  }
  if (s.timeLimitSec && Date.now() - s.startedAt.getTime() > (s.timeLimitSec + 10) * 1000) {
    return NextResponse.json({ error: 'time' }, { status: 409 });
  }

  const q = await db.question.findUnique({ where: { id: questionId }, include: { answers: true } });
  const chosen = q?.answers.find((a) => a.id === answerId);
  if (!q || !chosen) return NextResponse.json({ error: 'input' }, { status: 400 });

  try {
    await db.sessionAnswer.create({ data: { sessionId, questionId, answerId, isCorrect: chosen.isCorrect } });
  } catch {
    return NextResponse.json({ error: 'answered' }, { status: 409 });
  }
  await recordReview(user.id, questionId, chosen.isCorrect);

  if (!isPracticeMode(s.mode)) return NextResponse.json({ saved: true });
  const locale = await getLocale();
  return NextResponse.json({
    correct: chosen.isCorrect,
    correctId: q.answers.find((a) => a.isCorrect)?.id ?? null,
    explanation: pick(q, 'explanation', locale),
    ruleRef: q.ruleRef,
  });
}
