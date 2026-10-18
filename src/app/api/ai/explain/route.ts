import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { db } from '@/lib/db';
import { kv } from '@/lib/kv';
import { getCurrentUser } from '@/lib/session';
import { getAccess } from '@/lib/access';
import { rateLimit } from '@/lib/rate-limit';
import { getLocale } from '@/i18n/server';
import { pick, type Locale } from '@/i18n/config';

const LANG_NAME: Record<Locale, string> = {
  uz: 'Uzbek (Latin script)',
  'uz-Cyrl': 'Uzbek (Cyrillic script)',
  ru: 'Russian',
};

let client: Anthropic | null = null;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const parsed = z.object({ questionId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'input' }, { status: 400 });

  const { active } = await getAccess(user.id);
  const rl = active ? await rateLimit(`ai:${user.id}`, 30, 3600) : await rateLimit(`ai:free:${user.id}`, 5, 86400);
  if (!rl.ok) return NextResponse.json({ error: 'too_many', retryAfter: rl.retryAfter }, { status: 429 });

  const locale = await getLocale();
  const cacheKey = `ai:explain:${parsed.data.questionId}:${locale}`;
  const cached = await kv.get(cacheKey);
  if (cached) return NextResponse.json({ text: cached, cached: true });

  const q = await db.question.findUnique({ where: { id: parsed.data.questionId }, include: { answers: true } });
  if (!q) return NextResponse.json({ error: 'input' }, { status: 404 });
  const explanation = pick(q, 'explanation', locale);

  if (!process.env.ANTHROPIC_API_KEY) {
    // Dev fallback so the button works without an API key.
    return NextResponse.json({ text: `${explanation}\n\n(AI: set ANTHROPIC_API_KEY to enable simplified explanations.)`, mock: true });
  }

  const correct = q.answers.find((a) => a.isCorrect);
  client ??= new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: process.env.AI_MODEL ?? 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system:
        `You explain Uzbekistan road traffic rules to people preparing for the driving licence theory exam. ` +
        `Reply in ${LANG_NAME[locale]} only. Use plain words a beginner understands, 3–5 short sentences, ` +
        `and end with one practical tip for the road. Base the explanation only on the rule text provided; do not invent article numbers.`,
      messages: [
        {
          role: 'user',
          content:
            `Question: ${pick(q, 'text', locale)}\n` +
            `Correct answer: ${correct ? pick(correct, 'text', locale) : '-'}\n` +
            `Official explanation: ${explanation}\n` +
            (q.ruleRef ? `Rule reference: ${q.ruleRef}\n` : '') +
            `\nExplain this rule simply.`,
        },
      ],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (response.stop_reason === 'refusal') return NextResponse.json({ text: explanation, fallback: true });
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) return NextResponse.json({ text: explanation, fallback: true });
    await kv.set(cacheKey, text, 30 * 86400);
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'busy' }, { status: 503 });
    console.error('[ai/explain]', error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return NextResponse.json({ text: explanation, fallback: true });
  }
}
