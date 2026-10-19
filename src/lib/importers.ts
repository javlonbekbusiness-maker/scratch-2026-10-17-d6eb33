import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from './db';
import { parseCsv } from './csv';
import { normalizePhone, PHONE_RE } from './phone';
import { normalizeCode } from './promo';

export type RowError = { row: number; messages: string[] };
export type ImportKind = 'questions' | 'promo' | 'users';

const bool = z.preprocess((v) => ['1', 'true', 'yes', 'ha'].includes(String(v).toLowerCase()), z.boolean());
const optInt = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive().optional());
const optDate = z.preprocess((v) => (v ? new Date(String(v)) : undefined), z.date().optional().refine((d) => !d || !isNaN(d.getTime()), 'invalid date'));

// ─── Questions ───────────────────────────────────────────────────────────────

export const QUESTION_CSV_COLUMNS = [
  'external_id', 'category', 'ticket', 'topic',
  'text_uz', 'text_ru', 'image_url',
  ...[1, 2, 3, 4, 5].flatMap((n) => [`answer${n}_uz`, `answer${n}_ru`]),
  'correct', 'explanation_uz', 'explanation_ru', 'rule_ref', 'difficulty',
];

const l3 = z.object({ uz: z.string().trim().min(1, 'uz text required'), ru: z.string().trim().min(1, 'ru text required') });

const questionSchema = z
  .object({
    externalId: z.string().trim().max(64).optional().or(z.literal('')),
    category: z.string().trim().min(1, 'category required'),
    ticket: optInt,
    topic: z.string().trim().optional().default(''),
    text: l3,
    imageUrl: z.union([z.literal(''), z.string().trim().regex(/^(https:\/\/|\/)[^\s]+$/, 'image_url must be https:// or /path')]).optional(),
    answers: z.array(l3).min(3, 'need 3–5 answers').max(5, 'need 3–5 answers'),
    correct: z.coerce.number().int().min(1, 'correct must be 1–5'),
    explanation: z.object({ uz: z.string().trim().default(''), ru: z.string().trim().default('') }),
    ruleRef: z.string().trim().max(40).optional().default(''),
    difficulty: z.coerce.number().int().min(1).max(3).optional().default(1),
  })
  .refine((q) => q.correct <= q.answers.length, { message: 'correct points past the last answer', path: ['correct'] });

export type QuestionRow = z.infer<typeof questionSchema>;

function csvToQuestion(r: Record<string, string>) {
  const answers = [1, 2, 3, 4, 5]
    .map((n) => ({ uz: r[`answer${n}_uz`] ?? '', ru: r[`answer${n}_ru`] ?? '' }))
    .filter((a) => a.uz || a.ru);
  return {
    externalId: r.external_id,
    category: r.category,
    ticket: r.ticket ? Number(r.ticket) : undefined,
    topic: r.topic,
    text: { uz: r.text_uz ?? '', ru: r.text_ru ?? '' },
    imageUrl: r.image_url,
    answers,
    correct: r.correct,
    explanation: { uz: r.explanation_uz ?? '', ru: r.explanation_ru ?? '' },
    ruleRef: r.rule_ref,
    difficulty: r.difficulty || 1,
  };
}

function parseRows(text: string, format: 'csv' | 'json', mapCsv: (r: Record<string, string>) => unknown): unknown[] {
  if (format === 'json') {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('JSON must be an array of objects');
    return data;
  }
  return parseCsv(text).map(mapCsv);
}

async function lookups() {
  const [cats, topics] = await Promise.all([db.category.findMany(), db.topic.findMany()]);
  return {
    cat: new Map(cats.flatMap((c) => [[c.code.toUpperCase(), c.id], [c.slug.toUpperCase(), c.id]])),
    topic: new Map(topics.map((t) => [t.slug.toLowerCase(), t.id])),
    catCodes: cats.map((c) => c.code).join(', '),
    topicSlugs: topics.map((t) => t.slug).join(', '),
  };
}

export async function validateQuestions(text: string, format: 'csv' | 'json') {
  const raw = parseRows(text, format, csvToQuestion);
  const lk = await lookups();
  const rows: QuestionRow[] = [];
  const errors: RowError[] = [];
  raw.forEach((r, i) => {
    const parsed = questionSchema.safeParse(r);
    const messages: string[] = [];
    if (!parsed.success) messages.push(...parsed.error.issues.map((e) => `${e.path.join('.') || 'row'}: ${e.message}`));
    else {
      if (!lk.cat.has(parsed.data.category.toUpperCase())) messages.push(`unknown category "${parsed.data.category}" (have: ${lk.catCodes})`);
      if (parsed.data.topic && !lk.topic.has(parsed.data.topic.toLowerCase())) messages.push(`unknown topic "${parsed.data.topic}" (have: ${lk.topicSlugs})`);
    }
    if (messages.length) errors.push({ row: i + 2, messages });
    else if (parsed.success) rows.push(parsed.data);
  });
  return { rows, errors, total: raw.length };
}

export async function commitQuestions(rows: QuestionRow[]) {
  const lk = await lookups();
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const categoryId = lk.cat.get(r.category.toUpperCase())!;
    const data = {
      categoryId,
      topicId: r.topic ? lk.topic.get(r.topic.toLowerCase()) ?? null : null,
      ticketNumber: r.ticket ?? null,
      textUz: r.text.uz,
      textRu: r.text.ru,
      imageUrl: r.imageUrl || null,
      explanationUz: r.explanation.uz,
      explanationRu: r.explanation.ru,
      ruleRef: r.ruleRef || null,
      difficulty: r.difficulty,
    };
    const answers = r.answers.map((a, i) => ({ textUz: a.uz, textRu: a.ru, isCorrect: i + 1 === r.correct, sortOrder: i }));
    const existing = r.externalId ? await db.question.findUnique({ where: { externalId: r.externalId } }) : null;
    await db.$transaction(async (tx) => {
      if (existing) {
        await tx.answer.deleteMany({ where: { questionId: existing.id } });
        await tx.question.update({ where: { id: existing.id }, data: { ...data, answers: { create: answers } } });
        updated++;
      } else {
        await tx.question.create({ data: { ...data, externalId: r.externalId || null, answers: { create: answers } } });
        created++;
      }
      if (r.ticket) {
        await tx.ticket.upsert({ where: { categoryId_number: { categoryId, number: r.ticket } }, create: { categoryId, number: r.ticket }, update: {} });
      }
    });
  }
  return { created, updated };
}

// ─── Promo codes ─────────────────────────────────────────────────────────────

export const PROMO_CSV_COLUMNS = ['code', 'type', 'value', 'starts_at', 'ends_at', 'usage_limit', 'per_user_limit', 'min_order_uzs', 'plan_slugs', 'new_users_only', 'combinable', 'note'];

const promoSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, 'letters, digits, _ and - only'),
  type: z.enum(['PERCENT', 'FIXED', 'FREE_DAYS', 'FREE_TRIAL']),
  value: z.coerce.number().int().positive(),
  starts_at: optDate,
  ends_at: optDate,
  usage_limit: optInt,
  per_user_limit: optInt,
  min_order_uzs: optInt,
  plan_slugs: z.string().optional().default(''),
  new_users_only: bool.optional().default(false),
  combinable: bool.optional().default(false),
  note: z.string().max(200).optional().default(''),
}).refine((p) => p.type !== 'PERCENT' || p.value <= 100, { message: 'percent must be ≤ 100', path: ['value'] });

export type PromoRow = z.infer<typeof promoSchema>;

export async function validatePromos(text: string, format: 'csv' | 'json') {
  const raw = parseRows(text, format, (r) => r);
  const rows: PromoRow[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();
  const existing = new Set((await db.promoCode.findMany({ select: { code: true } })).map((c) => c.code));
  raw.forEach((r, i) => {
    const p = promoSchema.safeParse(r);
    if (!p.success) return errors.push({ row: i + 2, messages: p.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`) });
    const code = normalizeCode(p.data.code);
    if (existing.has(code) || seen.has(code)) return errors.push({ row: i + 2, messages: [`duplicate code ${code}`] });
    seen.add(code);
    rows.push({ ...p.data, code });
  });
  return { rows, errors, total: raw.length };
}

export async function commitPromos(rows: PromoRow[]) {
  const batchId = 'imp_' + randomBytes(4).toString('hex');
  await db.promoCode.createMany({
    data: rows.map((p) => ({
      code: p.code, type: p.type, value: p.value, startsAt: p.starts_at, endsAt: p.ends_at, usageLimit: p.usage_limit,
      perUserLimit: p.per_user_limit ?? 1, minOrderUzs: p.min_order_uzs, planSlugs: p.plan_slugs.split(/[|\s]+/).filter(Boolean),
      newUsersOnly: p.new_users_only, combinable: p.combinable, note: p.note || null, batchId,
    })),
  });
  return { created: rows.length, updated: 0 };
}

// ─── Users ───────────────────────────────────────────────────────────────────

export const USER_CSV_COLUMNS = ['phone', 'name', 'email', 'category', 'grant_days'];

const userSchema = z.object({
  phone: z.string().transform(normalizePhone).refine((p) => PHONE_RE.test(p), 'phone must be +998XXXXXXXXX'),
  name: z.string().trim().max(60).optional().default(''),
  email: z.union([z.literal(''), z.string().trim().toLowerCase().email()]).optional().default(''),
  category: z.string().trim().optional().default('B'),
  grant_days: optInt,
});
export type UserRow = z.infer<typeof userSchema>;

export async function validateUsers(text: string, format: 'csv' | 'json') {
  const raw = parseRows(text, format, (r) => r);
  const lk = await lookups();
  const rows: UserRow[] = [];
  const errors: RowError[] = [];
  raw.forEach((r, i) => {
    const p = userSchema.safeParse(r);
    if (!p.success) return errors.push({ row: i + 2, messages: p.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`) });
    if (p.data.category && !lk.cat.has(p.data.category.toUpperCase())) return errors.push({ row: i + 2, messages: [`unknown category ${p.data.category}`] });
    rows.push(p.data);
  });
  return { rows, errors, total: raw.length };
}

export async function commitUsers(rows: UserRow[]) {
  const lk = await lookups();
  const { grantDays } = await import('./access');
  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const categoryId = lk.cat.get((r.category || 'B').toUpperCase());
    const exists = await db.user.findUnique({ where: { phone: r.phone } });
    // Imported users still confirm their phone by OTP on first login; consent is collected then.
    const u = await db.user.upsert({
      where: { phone: r.phone },
      create: { phone: r.phone, name: r.name || null, email: r.email || null, categoryId, referralCode: randomBytes(5).toString('hex').toUpperCase(), onboarded: !!r.name },
      update: { name: r.name || undefined, categoryId },
    });
    if (exists) updated++;
    else created++;
    if (r.grant_days) await grantDays(u.id, r.grant_days, 'ADMIN');
  }
  return { created, updated };
}
