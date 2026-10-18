'use server';

import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { CampaignType, MessageChannel, PromoType, Role } from '@prisma/client';
import { db } from '@/lib/db';
import { kv } from '@/lib/kv';
import { requireAdmin } from '@/lib/session';
import { grantDays } from '@/lib/access';
import { normalizeCode } from '@/lib/promo';
import { latinToCyrillic } from '@/lib/translit';
import { z } from 'zod';
import { sendMessage } from '@/lib/notify';
import { SAMPLE_VARS, TEMPLATE_KEYS, TEMPLATE_VARS, type TemplateKey } from '@/lib/template-defaults';
import { templateVars } from '@/lib/sms-segments';
import { sniffImage } from '@/lib/image-sniff';
import { rateLimit } from '@/lib/rate-limit';
import { isLocale } from '@/i18n/config';
import { MESSAGES, flatten } from '@/i18n/translate';
import { shuffle } from '@/lib/tests';
import {
  commitPromos, commitQuestions, commitUsers, validatePromos, validateQuestions, validateUsers,
  type ImportKind, type RowError,
} from '@/lib/importers';

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const n = (fd: FormData, k: string) => (s(fd, k) === '' ? null : Number(s(fd, k)));
const b = (fd: FormData, k: string) => fd.get(k) === 'on' || fd.get(k) === 'true';
/** datetime-local inputs are entered in Tashkent time (UTC+5, no DST). */
const d = (fd: FormData, k: string) => {
  const v = s(fd, k);
  if (!v) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00+05:00` : v);
  return isNaN(date.getTime()) ? null : date;
};
/**
 * Cyrillic value for a field: what the admin typed, else transliterated from Uzbek.
 * Edit forms send the previous Uzbek text as `<uz>Prev`; if the Cyrillic is still the
 * automatic version of that old text and the Uzbek changed, it is regenerated so it
 * doesn't go stale. Hand-written Cyrillic is never overwritten.
 */
const cyOr = (fd: FormData, cy: string, uz: string) => {
  const cyVal = s(fd, cy);
  const uzVal = s(fd, uz);
  const prevUz = fd.has(`${uz}Prev`) ? s(fd, `${uz}Prev`) : null;
  if (!cyVal) return latinToCyrillic(uzVal);
  if (prevUz !== null && prevUz !== uzVal && cyVal === latinToCyrillic(prevUz)) return latinToCyrillic(uzVal);
  return cyVal;
};

// ─── Questions ───────────────────────────────────────────────────────────────

async function saveUpload(file: File | null) {
  if (!file || file.size === 0) return null;
  if (file.size > 2 * 1024 * 1024) throw new Error('Image must be under 2 MB');
  const bytes = Buffer.from(await file.arrayBuffer());
  // Trust the file's signature, not the browser-declared type (an SVG renamed to .png would pass a type check).
  // SVG is never accepted: it can carry scripts.
  const ext = sniffImage(bytes);
  if (!ext) throw new Error('Only PNG, JPEG or WebP images');
  // Local disk is fine for one server; use object storage (S3/R2/Cloudinary) when you scale out.
  const dir = join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(8).toString('hex')}.${ext}`;
  await writeFile(join(dir, name), bytes);
  return `/uploads/${name}`;
}

export async function saveQuestion(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  // Validation failures go back to the editor with a message instead of throwing (which showed a crash page).
  const back = (err: string): never => redirect(`/admin/questions/${encodeURIComponent(id || 'new')}?err=${err}`);
  const answers = [0, 1, 2, 3, 4]
    .map((i) => ({ uz: s(fd, `a${i}_uz`), cy: s(fd, `a${i}_cy`), ru: s(fd, `a${i}_ru`), i }))
    .filter((a) => a.uz || a.ru);
  const correct = Number(s(fd, 'correct'));
  if (!s(fd, 'textUz') || !s(fd, 'textRu')) back('text');
  if (answers.length < 3 || answers.length > 5) back('answers');
  if (answers.some((a) => !a.uz || !a.ru)) back('answer-langs');
  if (!answers.some((a) => a.i === correct)) back('correct');
  if (!(await db.category.findUnique({ where: { id: s(fd, 'categoryId') } }))) back('category');
  const ticket = n(fd, 'ticketNumber');
  if (ticket !== null && (!Number.isInteger(ticket) || ticket < 1 || ticket > 999)) back('ticket');
  const imageUrlField = s(fd, 'imageUrl');
  if (imageUrlField && !IMAGE_URL.test(imageUrlField)) back('image-url');
  let uploaded: string | null = null;
  try {
    uploaded = await saveUpload(fd.get('image') as File | null);
  } catch {
    back('image-file');
  }

  const data = {
    categoryId: s(fd, 'categoryId'),
    topicId: s(fd, 'topicId') || null,
    ticketNumber: n(fd, 'ticketNumber'),
    sortOrder: n(fd, 'sortOrder') ?? 0,
    textUz: s(fd, 'textUz'),
    textCy: cyOr(fd, 'textCy', 'textUz'),
    textRu: s(fd, 'textRu'),
    imageUrl: uploaded ?? (s(fd, 'imageUrl') || null),
    explanationUz: s(fd, 'explanationUz'),
    explanationCy: cyOr(fd, 'explanationCy', 'explanationUz'),
    explanationRu: s(fd, 'explanationRu'),
    ruleRef: s(fd, 'ruleRef') || null,
    difficulty: n(fd, 'difficulty') ?? 1,
    isActive: b(fd, 'isActive'),
  };
  const answerRows = answers.map((a, idx) => ({ textUz: a.uz, textCy: cyOr(fd, `a${a.i}_cy`, `a${a.i}_uz`), textRu: a.ru, isCorrect: a.i === correct, sortOrder: idx }));

  await db.$transaction(async (tx) => {
    if (id) {
      await tx.answer.deleteMany({ where: { questionId: id } });
      await tx.question.update({ where: { id }, data: { ...data, answers: { create: answerRows } } });
    } else {
      await tx.question.create({ data: { ...data, answers: { create: answerRows } } });
    }
    if (data.ticketNumber) {
      await tx.ticket.upsert({
        where: { categoryId_number: { categoryId: data.categoryId, number: data.ticketNumber } },
        create: { categoryId: data.categoryId, number: data.ticketNumber },
        update: {},
      });
    }
  });
  revalidatePath('/admin/questions');
  redirect('/admin/questions?saved=1');
}

export async function deleteQuestion(fd: FormData) {
  await requireAdmin();
  await db.question.delete({ where: { id: s(fd, 'id') } });
  revalidatePath('/admin/questions');
  redirect('/admin/questions');
}

// ─── Bulk import (validate → preview → commit) ───────────────────────────────

export type ImportPreview = { token?: string; kind: ImportKind; total: number; valid: number; errors: RowError[]; fatal?: string } | null;

export async function importPreview(_: ImportPreview, fd: FormData): Promise<ImportPreview> {
  await requireAdmin();
  const kind = s(fd, 'kind') as ImportKind;
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return { kind, total: 0, valid: 0, errors: [], fatal: 'Choose a file' };
  if (file.size > 10 * 1024 * 1024) return { kind, total: 0, valid: 0, errors: [], fatal: 'File too large (10 MB max)' };
  const format = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
  const text = await file.text();
  try {
    const v = kind === 'promo' ? await validatePromos(text, format) : kind === 'users' ? await validateUsers(text, format) : await validateQuestions(text, format);
    const token = randomBytes(12).toString('hex');
    if (v.rows.length) await kv.set(`import:${token}`, JSON.stringify({ kind, rows: v.rows }), 1800);
    return { token: v.rows.length ? token : undefined, kind, total: v.total, valid: v.rows.length, errors: v.errors.slice(0, 500) };
  } catch (e) {
    return { kind, total: 0, valid: 0, errors: [], fatal: e instanceof Error ? e.message : 'Could not parse file' };
  }
}

export async function importCommit(fd: FormData) {
  await requireAdmin();
  const raw = await kv.get(`import:${s(fd, 'token')}`);
  if (!raw) redirect('/admin/import?expired=1');
  const { kind, rows } = JSON.parse(raw);
  await kv.del(`import:${s(fd, 'token')}`);
  const r = kind === 'promo' ? await commitPromos(rows) : kind === 'users' ? await commitUsers(rows) : await commitQuestions(rows);
  redirect(`/admin/import?done=${kind}&created=${r.created}&updated=${r.updated}`);
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

const ticketsBack = (categoryId: string, msg: string) => redirect(`/admin/tickets?category=${encodeURIComponent(categoryId)}&msg=${msg}`);

export async function toggleTicketFree(fd: FormData) {
  await requireAdmin();
  const t = await db.ticket.findUnique({ where: { id: s(fd, 'id') } });
  if (!t) redirect('/admin/tickets');
  await db.ticket.update({ where: { id: t.id }, data: { isFree: !t.isFree } });
  revalidatePath('/', 'layout');
  ticketsBack(t.categoryId, t.isFree ? `locked-${t.number}` : `free-${t.number}`);
}

/** Removes a ticket row that no longer has any questions. */
export async function deleteEmptyTicket(fd: FormData) {
  await requireAdmin();
  const t = await db.ticket.findUnique({ where: { id: s(fd, 'id') } });
  if (!t) redirect('/admin/tickets');
  const count = await db.question.count({ where: { categoryId: t.categoryId, ticketNumber: t.number } });
  if (count) ticketsBack(t.categoryId, 'not-empty');
  await db.ticket.delete({ where: { id: t.id } });
  revalidatePath('/admin/tickets');
  ticketsBack(t.categoryId, `deleted-${t.number}`);
}

/**
 * Re-deals the active questions of a category into numbered tickets using a TICKET template's size and topic mix.
 * Questions that don't fill a whole last ticket stay unassigned (still used by topic, marathon and exam modes).
 */
export async function generateTickets(fd: FormData) {
  await requireAdmin();
  const tpl = await db.examTemplate.findUnique({ where: { id: s(fd, 'templateId') } });
  if (!tpl || tpl.kind !== 'TICKET') redirect('/admin/tickets?msg=no-template');
  const categoryId = tpl.categoryId;
  const all = shuffle(await db.question.findMany({ where: { categoryId, isActive: true }, select: { id: true, topic: { select: { slug: true } } } }));
  const size = tpl.questionCount;
  // Never wipe existing tickets when there aren't enough questions for even one.
  if (all.length < size) ticketsBack(categoryId, `too-few-${all.length}-${size}`);

  const mix = (tpl.topicMix ?? {}) as Record<string, number>;
  const pool = [...all];
  const tickets: string[][] = [];
  while (pool.length >= size) {
    const pick: string[] = [];
    for (const [slug, count] of Object.entries(mix)) {
      for (let k = 0; k < count && pick.length < size; k++) {
        const idx = pool.findIndex((q) => q.topic?.slug === slug);
        if (idx >= 0) pick.push(pool.splice(idx, 1)[0].id);
      }
    }
    while (pick.length < size && pool.length) pick.push(pool.shift()!.id);
    tickets.push(pick);
  }
  const freeBefore = new Set((await db.ticket.findMany({ where: { categoryId, isFree: true } })).map((t) => t.number));
  await db.$transaction([
    db.question.updateMany({ where: { categoryId }, data: { ticketNumber: null } }),
    db.ticket.deleteMany({ where: { categoryId } }),
    ...tickets.flatMap((ids, i) => [
      db.ticket.create({ data: { categoryId, number: i + 1, isFree: freeBefore.size ? freeBefore.has(i + 1) : i < 2 } }),
      ...ids.map((id, j) => db.question.update({ where: { id }, data: { ticketNumber: i + 1, sortOrder: j } })),
    ]),
  ]);
  revalidatePath('/', 'layout');
  ticketsBack(categoryId, `generated-${tickets.length}-${pool.length}`);
}

// ─── Categories & topics ─────────────────────────────────────────────────────

const catBack = (msg: string, extra = '') => redirect(`/admin/categories?msg=${msg}${extra}`);

export async function saveCategory(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  const code = s(fd, 'code').toUpperCase();
  const data = {
    code,
    nameUz: s(fd, 'nameUz'),
    nameCy: cyOr(fd, 'nameCy', 'nameUz'),
    nameRu: s(fd, 'nameRu'),
    descUz: s(fd, 'descUz'),
    descCy: cyOr(fd, 'descCy', 'descUz'),
    descRu: s(fd, 'descRu'),
    sortOrder: n(fd, 'sortOrder') ?? 0,
    isActive: b(fd, 'isActive'),
  };
  if (!/^[A-Z0-9]{1,4}$/.test(code)) catBack('cat-code', `&edit=${id}`);
  if (!data.nameUz || !data.nameRu || data.nameUz.length > 60 || data.nameRu.length > 60) catBack('cat-name', `&edit=${id}`);
  if (!Number.isInteger(data.sortOrder)) catBack('bad-order', `&edit=${id}`);
  const clash = await db.category.findFirst({ where: { OR: [{ code }, { slug: code.toLowerCase() }], ...(id ? { id: { not: id } } : {}) } });
  if (clash) catBack('cat-exists', `&edit=${id}`);
  if (id) {
    // The slug stays fixed: it is part of stored references and URLs.
    await db.category.update({ where: { id }, data });
  } else {
    await db.category.create({ data: { ...data, slug: code.toLowerCase() } });
  }
  revalidatePath('/', 'layout');
  catBack(id ? 'cat-saved' : 'cat-created');
}

export async function deleteCategory(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  const [questions, users, templates] = await Promise.all([
    db.question.count({ where: { categoryId: id } }),
    db.user.count({ where: { categoryId: id } }),
    db.examTemplate.count({ where: { categoryId: id } }),
  ]);
  if (questions || users) catBack('cat-in-use', `&q=${questions}&u=${users}`);
  await db.$transaction([
    db.examTemplate.deleteMany({ where: { categoryId: id } }),
    db.ticket.deleteMany({ where: { categoryId: id } }),
    db.category.delete({ where: { id } }),
  ]);
  revalidatePath('/', 'layout');
  catBack('cat-deleted', templates ? `&t=${templates}` : '');
}

export async function saveTopic(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  const data = {
    nameUz: s(fd, 'nameUz'),
    nameCy: cyOr(fd, 'nameCy', 'nameUz'),
    nameRu: s(fd, 'nameRu'),
    icon: s(fd, 'icon').slice(0, 8) || '📘',
    sortOrder: n(fd, 'sortOrder') ?? 0,
  };
  if (!data.nameUz || !data.nameRu || data.nameUz.length > 60 || data.nameRu.length > 60) catBack('topic-name');
  if (!Number.isInteger(data.sortOrder)) catBack('bad-order');
  if (id) {
    // Slugs are referenced by exam-template topic mixes and imports, so they can't be renamed.
    await db.topic.update({ where: { id }, data });
  } else {
    const slug = s(fd, 'slug').toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(slug)) catBack('topic-slug');
    if (await db.topic.findUnique({ where: { slug } })) catBack('topic-exists');
    await db.topic.create({ data: { ...data, slug } });
  }
  revalidatePath('/', 'layout');
  catBack(id ? 'topic-saved' : 'topic-created');
}

export async function deleteTopic(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  const topic = await db.topic.findUnique({ where: { id } });
  if (!topic) catBack('topic-deleted');
  const questions = await db.question.count({ where: { topicId: id } });
  if (questions) catBack('topic-in-use', `&q=${questions}`);
  const usedIn = (await db.examTemplate.findMany()).filter((t) => Object.keys((t.topicMix ?? {}) as object).includes(topic!.slug));
  if (usedIn.length) catBack('topic-in-mix', `&t=${usedIn.length}`);
  await db.topic.delete({ where: { id } });
  revalidatePath('/', 'layout');
  catBack('topic-deleted');
}

// ─── Exam / ticket templates ─────────────────────────────────────────────────

/** "signs: 5, priority = 3" → { signs: 5, priority: 3 }; returns an error string for malformed parts. */
function parseMix(raw: string): Record<string, number> | string {
  const out: Record<string, number> = {};
  for (const part of raw.split(/[,\n;]/).map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^([a-z0-9-]+)\s*[:=]\s*(\d+)$/i);
    if (!m || Number(m[2]) < 1) return `Topic mix: “${part}” — use topic:count, e.g. signs: 5`;
    out[m[1].toLowerCase()] = (out[m[1].toLowerCase()] ?? 0) + Number(m[2]);
  }
  return out;
}

export type TemplateFormState = { error: string; values: Record<string, string | string[]>; attempt: number } | null;

export async function saveExamTemplate(prev: TemplateFormState, fd: FormData): Promise<TemplateFormState> {
  await requireAdmin();
  const fail = (error: string) => ({ error, values: formValues(fd), attempt: (prev?.attempt ?? 0) + 1 });
  const kind = s(fd, 'kind') === 'TICKET' ? 'TICKET' : 'EXAM';
  const mix = parseMix(s(fd, 'topicMix'));
  if (typeof mix === 'string') return fail(mix);
  const data = {
    name: s(fd, 'name'),
    kind,
    categoryId: s(fd, 'categoryId'),
    questionCount: n(fd, 'questionCount') ?? 0,
    timeLimitSec: kind === 'EXAM' ? (n(fd, 'timeLimitMin') ?? 0) * 60 : 0,
    passPercent: n(fd, 'passPercent') ?? 0,
    topicMix: mix,
  };
  if (!data.name || data.name.length > 80) return fail('Name is required (max 80 characters).');
  if (!(await db.category.findUnique({ where: { id: data.categoryId } }))) return fail('Choose a category.');
  if (!Number.isInteger(data.questionCount) || data.questionCount < 1 || data.questionCount > 100) return fail('Questions must be 1–100.');
  if (kind === 'EXAM' && (!Number.isInteger(data.timeLimitSec / 60) || data.timeLimitSec < 60 || data.timeLimitSec > 180 * 60)) return fail('Time limit must be 1–180 minutes.');
  if (!Number.isInteger(data.passPercent) || data.passPercent < 1 || data.passPercent > 100) return fail('Pass mark must be 1–100%.');
  const mixTotal = Object.values(mix).reduce((a, b) => a + b, 0);
  if (mixTotal > data.questionCount) return fail(`Topic mix asks for ${mixTotal} questions but the template has only ${data.questionCount}.`);
  const known = new Set((await db.topic.findMany({ select: { slug: true } })).map((t) => t.slug));
  const unknown = Object.keys(mix).filter((k) => !known.has(k));
  if (unknown.length) return fail(`Unknown topic: ${unknown.join(', ')}. Use the topic slugs from Categories & topics.`);

  const id = s(fd, 'id');
  if (id) {
    await db.examTemplate.update({ where: { id }, data });
  } else {
    // The first template of a kind in a category becomes its default.
    const hasDefault = await db.examTemplate.count({ where: { categoryId: data.categoryId, kind, isDefault: true } });
    await db.examTemplate.create({ data: { ...data, isDefault: !hasDefault } });
  }
  revalidatePath('/', 'layout');
  redirect(`/admin/exam?msg=${id ? 'saved' : 'created'}`);
}

export async function examTemplateAction(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  const t = await db.examTemplate.findUnique({ where: { id } });
  if (!t) redirect('/admin/exam');
  let msg = '';
  switch (s(fd, 'op')) {
    case 'duplicate': {
      const copy = await db.examTemplate.create({
        data: { name: `${t.name} (copy)`.slice(0, 80), kind: t.kind, categoryId: t.categoryId, questionCount: t.questionCount, timeLimitSec: t.timeLimitSec, passPercent: t.passPercent, topicMix: t.topicMix ?? {} },
      });
      revalidatePath('/admin/exam');
      redirect(`/admin/exam?msg=duplicated&edit=${copy.id}`);
    }
    case 'default':
      await db.$transaction([
        db.examTemplate.updateMany({ where: { categoryId: t.categoryId, kind: t.kind }, data: { isDefault: false } }),
        db.examTemplate.update({ where: { id }, data: { isDefault: true } }),
      ]);
      msg = 'default';
      break;
    case 'delete':
      if (t.isDefault) redirect('/admin/exam?msg=delete-default');
      await db.examTemplate.delete({ where: { id } });
      msg = 'deleted';
      break;
  }
  revalidatePath('/', 'layout');
  redirect(`/admin/exam?msg=${msg}`);
}

// ─── Library ─────────────────────────────────────────────────────────────────

const libBack = (tab: 'signs' | 'rules', msg: string, extra = '') => redirect(`/admin/library?tab=${tab}&msg=${msg}${extra}`);
const IMAGE_URL = /^(https:\/\/|\/)[^\s"'<>]+$/;

export async function saveSign(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  let uploaded: string | null = null;
  try {
    uploaded = await saveUpload(fd.get('image') as File | null);
  } catch (e) {
    libBack('signs', 'bad-image', `&edit=${id || 'new'}`);
  }
  const imageUrl = uploaded ?? s(fd, 'imageUrl');
  const data = {
    code: s(fd, 'code'),
    group: s(fd, 'group'),
    nameUz: s(fd, 'nameUz'),
    nameCy: cyOr(fd, 'nameCy', 'nameUz'),
    nameRu: s(fd, 'nameRu'),
    descUz: s(fd, 'descUz'),
    descCy: cyOr(fd, 'descCy', 'descUz'),
    descRu: s(fd, 'descRu'),
    imageUrl,
    sortOrder: n(fd, 'sortOrder') ?? 0,
  };
  if (!data.code || data.code.length > 20 || !data.group || data.group.length > 80) libBack('signs', 'sign-code', `&edit=${id || 'new'}`);
  if (!data.nameUz || !data.nameRu || data.nameUz.length > 120 || data.nameRu.length > 120) libBack('signs', 'sign-name', `&edit=${id || 'new'}`);
  if (!IMAGE_URL.test(imageUrl)) libBack('signs', 'sign-image', `&edit=${id || 'new'}`);
  if (!Number.isInteger(data.sortOrder)) libBack('signs', 'bad-order', `&edit=${id || 'new'}`);
  if (id) await db.roadSign.update({ where: { id }, data });
  else await db.roadSign.create({ data });
  revalidatePath('/', 'layout');
  libBack('signs', id ? 'sign-saved' : 'sign-created');
}

export async function saveArticle(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  const data = {
    number: s(fd, 'number'),
    chapter: s(fd, 'chapter'),
    titleUz: s(fd, 'titleUz'),
    titleCy: cyOr(fd, 'titleCy', 'titleUz'),
    titleRu: s(fd, 'titleRu'),
    bodyUz: s(fd, 'bodyUz'),
    bodyCy: cyOr(fd, 'bodyCy', 'bodyUz'),
    bodyRu: s(fd, 'bodyRu'),
  };
  if (!/^[\p{L}\d][\p{L}\d.\-]{0,19}$/u.test(data.number)) libBack('rules', 'rule-number', `&edit=${id || 'new'}`);
  if (!data.titleUz || !data.titleRu || !data.bodyUz || !data.bodyRu) libBack('rules', 'rule-text', `&edit=${id || 'new'}`);
  const clash = await db.ruleArticle.findFirst({ where: { number: data.number, ...(id ? { id: { not: id } } : {}) } });
  if (clash) libBack('rules', 'rule-exists', `&edit=${id || 'new'}`);
  if (id) await db.ruleArticle.update({ where: { id }, data });
  else await db.ruleArticle.create({ data });
  revalidatePath('/', 'layout');
  libBack('rules', id ? 'rule-saved' : 'rule-created');
}

export async function deleteLibraryItem(fd: FormData) {
  await requireAdmin();
  const type = s(fd, 'type') === 'sign' ? 'signs' : 'rules';
  if (type === 'signs') await db.roadSign.deleteMany({ where: { id: s(fd, 'id') } });
  else await db.ruleArticle.deleteMany({ where: { id: s(fd, 'id') } });
  revalidatePath('/', 'layout');
  libBack(type, 'deleted');
}

// ─── Users & plans ───────────────────────────────────────────────────────────

function userBack(userId: string, msg: string) {
  redirect(`/admin/users/${encodeURIComponent(userId)}?msg=${msg}`);
}

export async function grantUserDays(fd: FormData) {
  await requireAdmin();
  const userId = s(fd, 'userId');
  const days = n(fd, 'days') ?? 0;
  if (!Number.isInteger(days) || days < 1 || days > 3650) userBack(userId, 'bad-days');
  if (!(await db.user.findUnique({ where: { id: userId }, select: { id: true } }))) redirect('/admin/users');
  await grantDays(userId, days, 'ADMIN');
  revalidatePath(`/admin/users/${userId}`);
  userBack(userId, `granted-${days}`);
}

export async function revokeAccess(fd: FormData) {
  await requireAdmin();
  const userId = s(fd, 'userId');
  const now = new Date();
  // Covers the current period and any stacked future periods.
  const r = await db.subscription.updateMany({ where: { userId, expiresAt: { gt: now } }, data: { expiresAt: now } });
  revalidatePath(`/admin/users/${userId}`);
  userBack(userId, r.count ? 'revoked' : 'nothing-to-revoke');
}

export async function setUserRole(fd: FormData) {
  const admin = await requireAdmin();
  const userId = s(fd, 'userId');
  const role = s(fd, 'role');
  if (role !== 'USER' && role !== 'ADMIN') userBack(userId, 'bad-role');
  if (userId === admin.id) userBack(userId, 'self-role');
  if (role === 'USER' && (await db.user.count({ where: { role: 'ADMIN' } })) <= 1) userBack(userId, 'last-admin');
  await db.user.update({ where: { id: userId }, data: { role: role as Role } });
  revalidatePath(`/admin/users/${userId}`);
  userBack(userId, role === 'ADMIN' ? 'made-admin' : 'made-user');
}

export async function savePlan(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  const back = (msg: string) => redirect(`/admin/plans?msg=${msg}&plan=${encodeURIComponent(id)}`);
  const plan = await db.plan.findUnique({ where: { id } });
  if (!plan) redirect('/admin/plans');
  const data = {
    priceUzs: n(fd, 'priceUzs') ?? 0,
    durationDays: n(fd, 'durationDays') ?? 0,
    labelUz: s(fd, 'labelUz'),
    labelCy: cyOr(fd, 'labelCy', 'labelUz'),
    labelRu: s(fd, 'labelRu'),
    isFeatured: b(fd, 'isFeatured'),
    isActive: b(fd, 'isActive'),
    sortOrder: n(fd, 'sortOrder') ?? 0,
  };
  if (!Number.isInteger(data.priceUzs) || data.priceUzs < 1000 || data.priceUzs > 10_000_000) back('bad-price');
  if (!Number.isInteger(data.durationDays) || data.durationDays < 1 || data.durationDays > 3650) back('bad-duration');
  if (!data.labelUz || !data.labelRu || data.labelUz.length > 40 || data.labelRu.length > 40) back('bad-label');
  if (!Number.isInteger(data.sortOrder)) back('bad-order');
  if (!data.isActive && plan.isActive && (await db.plan.count({ where: { isActive: true, id: { not: id } } })) === 0) back('last-plan');

  await db.$transaction([
    // A single "Best value" badge keeps the pricing page clear.
    ...(data.isFeatured ? [db.plan.updateMany({ where: { id: { not: id } }, data: { isFeatured: false } })] : []),
    db.plan.update({ where: { id }, data }),
  ]);
  revalidatePath('/', 'layout');
  back('saved');
}

// ─── Promo codes & partners ──────────────────────────────────────────────────

function promoData(fd: FormData) {
  const oneTime = b(fd, 'oneTime');
  return {
    type: s(fd, 'type') as PromoType,
    value: n(fd, 'value') ?? 0,
    startsAt: d(fd, 'startsAt'),
    endsAt: d(fd, 'endsAt'),
    usageLimit: oneTime ? 1 : n(fd, 'usageLimit'),
    perUserLimit: n(fd, 'perUserLimit') ?? 1,
    minOrderUzs: n(fd, 'minOrderUzs'),
    planSlugs: fd.getAll('planSlugs').map(String),
    newUsersOnly: b(fd, 'newUsersOnly'),
    combinable: b(fd, 'combinable'),
    partnerId: s(fd, 'partnerId') || null,
    note: s(fd, 'note') || null,
  };
}

/** Returns an error message, or null when the rules are consistent. */
function promoRuleError(p: ReturnType<typeof promoData>) {
  if (!['PERCENT', 'FIXED', 'FREE_DAYS', 'FREE_TRIAL'].includes(p.type)) return 'Choose a code type.';
  if (!Number.isInteger(p.value) || p.value < 1) return 'Value must be a whole number above 0.';
  if (p.type === 'PERCENT' && p.value > 100) return 'Percent must be between 1 and 100.';
  if ((p.type === 'FREE_DAYS' || p.type === 'FREE_TRIAL') && p.value > 3650) return 'Days must be 3650 or fewer.';
  if (p.startsAt && p.endsAt && p.endsAt <= p.startsAt) return 'End date must be after the start date.';
  if (p.usageLimit != null && (!Number.isInteger(p.usageLimit) || p.usageLimit < 1)) return 'Total usage limit must be 1 or more (leave empty for unlimited).';
  if (!Number.isInteger(p.perUserLimit) || p.perUserLimit < 1) return 'Per-user limit must be 1 or more.';
  if (p.minOrderUzs != null && (!Number.isInteger(p.minOrderUzs) || p.minOrderUzs < 0)) return 'Minimum order must be 0 or more.';
  return null;
}

export type PromoFormState = { error: string; values: Record<string, string | string[]>; attempt: number } | null;

function formValues(fd: FormData) {
  const out: Record<string, string | string[]> = {};
  for (const k of new Set(fd.keys())) {
    if (k.startsWith('$')) continue;
    const all = fd.getAll(k).map(String);
    out[k] = k === 'planSlugs' ? all : all[0];
  }
  return out;
}

export async function savePromo(prev: PromoFormState, fd: FormData): Promise<PromoFormState> {
  await requireAdmin();
  const fail = (error: string) => ({ error, values: formValues(fd), attempt: (prev?.attempt ?? 0) + 1 });
  const data = promoData(fd);
  const ruleError = promoRuleError(data);
  if (ruleError) return fail(ruleError);
  if (data.partnerId && !(await db.partner.findUnique({ where: { id: data.partnerId } }))) return fail('Partner not found.');

  const id = s(fd, 'id');
  if (id) {
    await db.promoCode.update({ where: { id }, data: { ...data, isActive: b(fd, 'isActive') } });
  } else {
    const code = normalizeCode(s(fd, 'code'));
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return fail('Code must be 3–40 characters: letters, digits, _ or -.');
    if (await db.promoCode.findUnique({ where: { code } })) return fail(`Code ${code} already exists.`);
    await db.promoCode.create({ data: { ...data, code } });
  }
  revalidatePath('/admin/promo');
  redirect(`/admin/promo?msg=${id ? 'updated' : 'created'}`);
}

export async function promoAction(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  const back = s(fd, 'back') || '/admin/promo';
  const sep = back.includes('?') ? '&' : '?';
  let msg = '';
  if (s(fd, 'op') === 'toggle') {
    const p = await db.promoCode.findUniqueOrThrow({ where: { id } });
    await db.promoCode.update({ where: { id }, data: { isActive: !p.isActive } });
    msg = p.isActive ? 'paused' : 'resumed';
  } else if (s(fd, 'op') === 'delete') {
    // Codes referenced by payments or redemptions are paused instead, so those records keep their link.
    const [used, payments] = await Promise.all([db.promoUse.count({ where: { promoCodeId: id } }), db.payment.count({ where: { promoCodeId: id } })]);
    if (used || payments) {
      await db.promoCode.update({ where: { id }, data: { isActive: false } });
      msg = 'kept';
    } else {
      await db.promoCode.delete({ where: { id } });
      msg = 'deleted';
    }
  }
  revalidatePath('/admin/promo');
  redirect(`${back.startsWith('/admin/promo') ? back : '/admin/promo'}${sep}msg=${msg}`);
}

export async function bulkGeneratePromos(prev: PromoFormState, fd: FormData): Promise<PromoFormState> {
  await requireAdmin();
  const fail = (error: string) => ({ error, values: formValues(fd), attempt: (prev?.attempt ?? 0) + 1 });
  const count = n(fd, 'count') ?? 0;
  if (!Number.isInteger(count) || count < 1 || count > 5000) return fail('Count must be between 1 and 5000.');
  const prefix = normalizeCode(s(fd, 'prefix'));
  if (!/^[A-Z0-9_-]{0,12}$/.test(prefix)) return fail('Prefix: up to 12 letters, digits, _ or -.');
  const data = promoData(fd);
  const ruleError = promoRuleError({ ...data, usageLimit: 1, perUserLimit: 1 });
  if (ruleError) return fail(ruleError);

  const batchId = 'b_' + randomBytes(4).toString('hex');
  const base = { ...data, usageLimit: 1, perUserLimit: 1, batchId };
  // 31-symbol alphabet without look-alikes (0/O, 1/I); 8 symbols ≈ 8.5e11 combinations.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes = new Set<string>();
  while (codes.size < count) {
    const bytes = randomBytes(8);
    codes.add(prefix + Array.from(bytes, (x) => alphabet[x % alphabet.length]).join(''));
  }
  const created = await db.promoCode.createMany({ data: [...codes].map((code) => ({ ...base, code })), skipDuplicates: true });
  revalidatePath('/admin/promo');
  redirect(`/admin/promo?batch=${batchId}&n=${created.count}`);
}

export async function savePartner(fd: FormData) {
  await requireAdmin();
  const name = s(fd, 'name');
  const pct = n(fd, 'commissionPct') ?? 0;
  if (!name || name.length > 80) redirect('/admin/promo?msg=partner-name');
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) redirect('/admin/promo?msg=partner-pct');
  await db.partner.create({ data: { name, contact: s(fd, 'contact') || null, commissionPct: Math.round(pct) } });
  revalidatePath('/admin/promo');
  redirect('/admin/promo?msg=partner-added');
}

export async function deletePartner(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  // Unlink codes first; their own history stays intact.
  await db.$transaction([db.promoCode.updateMany({ where: { partnerId: id }, data: { partnerId: null } }), db.partner.delete({ where: { id } })]);
  revalidatePath('/admin/promo');
  redirect('/admin/promo?msg=partner-deleted');
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

/** Midnight in Tashkent (UTC+5) on the next occurrence of month/day. */
function nextTashkentDate(month: number, day: number) {
  const make = (y: number) => new Date(`${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+05:00`);
  const now = new Date();
  const y = Number(new Date(now.getTime() + 5 * 3600_000).toISOString().slice(0, 4));
  return make(y) > now ? make(y) : make(y + 1);
}
/** Black Friday = last Friday of November, from Tashkent midnight. */
function blackFriday() {
  const now = new Date();
  const find = (y: number) => {
    for (let day = 30; day >= 24; day--) {
      if (new Date(Date.UTC(y, 10, day)).getUTCDay() === 5) return new Date(`${y}-11-${day}T00:00:00+05:00`);
    }
    throw new Error('unreachable');
  };
  const y = now.getUTCFullYear();
  const bf = find(y);
  return bf > now ? bf : find(y + 1);
}
const plusDays = (d0: Date, days: number) => new Date(d0.getTime() + days * 86400_000);

/** Welcome, referral and win-back are single settings: only one of each may be active. */
const SINGLETON_TYPES: CampaignType[] = ['WELCOME', 'REFERRAL', 'WINBACK'];

export async function applyCampaignPreset(fd: FormData) {
  await requireAdmin();
  const preset = s(fd, 'preset');
  // Partner discounts are delivered through promo codes, never automatically.
  if (preset === 'school') redirect('/admin/promo?preset=school#new');
  const navruz = nextTashkentDate(3, 19);
  const indep = nextTashkentDate(8, 29);
  const bf = blackFriday();
  type Preset = { name: string; type: CampaignType; discountPct: number; durationHours?: number; startsAt?: Date; endsAt?: Date; bannerUz?: string; bannerRu?: string };
  const presets: Record<string, Preset> = {
    welcome: { name: 'Welcome offer', type: 'WELCOME', discountPct: 20, durationHours: 24 },
    navruz: { name: 'Navruz sale', type: 'SEASONAL', discountPct: 25, startsAt: navruz, endsAt: plusDays(navruz, 5), bannerUz: "Navro'z bayrami bilan! Barcha tariflarga −25%", bannerRu: 'С праздником Навруз! −25% на все тарифы' },
    independence: { name: 'Independence Day sale', type: 'SEASONAL', discountPct: 30, startsAt: indep, endsAt: plusDays(indep, 5), bannerUz: 'Mustaqillik kuni munosabati bilan −30%', bannerRu: 'Ко Дню независимости −30%' },
    blackfriday: { name: 'Black Friday', type: 'SEASONAL', discountPct: 40, startsAt: bf, endsAt: plusDays(bf, 4), bannerUz: 'Black Friday: −40% faqat 4 kun!', bannerRu: 'Black Friday: −40% только 4 дня!' },
    referral: { name: 'Referral reward', type: 'REFERRAL', discountPct: 10 },
    winback: { name: 'Win-back', type: 'WINBACK', discountPct: 20 },
  };
  const p = presets[preset];
  if (!p) redirect('/admin/campaigns');
  const c = await db.campaign.create({
    data: {
      name: p.name, type: p.type, discountPct: p.discountPct, durationHours: p.durationHours, startsAt: p.startsAt, endsAt: p.endsAt,
      bannerUz: p.bannerUz ?? '', bannerCy: latinToCyrillic(p.bannerUz ?? ''), bannerRu: p.bannerRu ?? '', isActive: false,
    },
  });
  revalidatePath('/admin/campaigns');
  redirect(`/admin/campaigns?edit=${c.id}&msg=preset`);
}

export type CampaignFormState = { error: string; values: Record<string, string | string[]>; attempt: number } | null;

export async function saveCampaign(prev: CampaignFormState, fd: FormData): Promise<CampaignFormState> {
  await requireAdmin();
  const fail = (error: string) => ({ error, values: formValues(fd), attempt: (prev?.attempt ?? 0) + 1 });
  const type = s(fd, 'type') as CampaignType;
  const data = {
    name: s(fd, 'name'),
    type,
    discountPct: n(fd, 'discountPct') ?? 0,
    durationHours: type === 'WELCOME' ? n(fd, 'durationHours') : null,
    startsAt: d(fd, 'startsAt'),
    endsAt: d(fd, 'endsAt'),
    isActive: b(fd, 'isActive'),
    bannerUz: s(fd, 'bannerUz').slice(0, 140),
    bannerCy: cyOr(fd, 'bannerCy', 'bannerUz').slice(0, 140),
    bannerRu: s(fd, 'bannerRu').slice(0, 140),
    planSlugs: fd.getAll('planSlugs').map(String),
  };
  if (!data.name || data.name.length > 80) return fail('Name is required (max 80 characters).');
  if (!['WELCOME', 'SEASONAL', 'WINBACK', 'REFERRAL'].includes(type)) return fail('Choose a campaign type.');
  if (!Number.isInteger(data.discountPct) || data.discountPct < 1 || data.discountPct > 90) return fail('Discount must be a whole number from 1 to 90%.');
  if (type === 'WELCOME' && (!Number.isInteger(data.durationHours) || data.durationHours! < 1 || data.durationHours! > 720))
    return fail('Welcome offer window must be 1–720 hours after phone verification.');
  if (type === 'SEASONAL' && (!data.startsAt || !data.endsAt)) return fail('A seasonal sale needs both a start and an end date.');
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) return fail('End date must be after the start date.');
  if (type === 'SEASONAL' && data.isActive && !data.bannerUz && !data.bannerRu) return fail('Add banner text (at least Uzbek or Russian) so visitors see the sale.');

  const id = s(fd, 'id');
  await db.$transaction(async (tx) => {
    if (data.isActive && SINGLETON_TYPES.includes(type)) {
      await tx.campaign.updateMany({ where: { type, isActive: true, ...(id ? { id: { not: id } } : {}) }, data: { isActive: false } });
    }
    if (id) await tx.campaign.update({ where: { id }, data });
    else await tx.campaign.create({ data });
  });
  revalidatePath('/', 'layout');
  redirect(`/admin/campaigns?msg=${id ? 'updated' : 'created'}`);
}

export async function campaignAction(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  let msg = '';
  if (s(fd, 'op') === 'toggle') {
    const c = await db.campaign.findUniqueOrThrow({ where: { id } });
    if (!c.isActive && c.type === 'SEASONAL' && !c.bannerUz && !c.bannerRu) redirect(`/admin/campaigns?edit=${id}&msg=need-banner`);
    await db.$transaction(async (tx) => {
      if (!c.isActive && SINGLETON_TYPES.includes(c.type)) {
        await tx.campaign.updateMany({ where: { type: c.type, isActive: true, id: { not: id } }, data: { isActive: false } });
      }
      await tx.campaign.update({ where: { id }, data: { isActive: !c.isActive } });
    });
    msg = c.isActive ? 'paused' : 'activated';
  } else if (s(fd, 'op') === 'delete') {
    const used = await db.payment.count({ where: { campaignId: id } });
    if (used) {
      await db.campaign.update({ where: { id }, data: { isActive: false } });
      msg = 'kept';
    } else {
      await db.campaign.delete({ where: { id } });
      msg = 'deleted';
    }
  }
  revalidatePath('/', 'layout');
  redirect(`/admin/campaigns?msg=${msg}`);
}

// ─── Message templates ───────────────────────────────────────────────────────

const CHANNELS: MessageChannel[] = ['SMS', 'EMAIL', 'PUSH'];
const TEMPLATE_LANGS = ['uz', 'uz-Cyrl', 'ru'];

function parseTemplateTarget(fd: FormData) {
  const key = s(fd, 'key') as TemplateKey;
  const channel = s(fd, 'channel') as MessageChannel;
  const lang = s(fd, 'lang');
  if (!(TEMPLATE_KEYS as readonly string[]).includes(key) || !CHANNELS.includes(channel) || !TEMPLATE_LANGS.includes(lang)) redirect('/admin/messages');
  return { key, channel, lang, back: (msg: string) => redirect(`/admin/messages?key=${key}&channel=${channel}&lang=${encodeURIComponent(lang)}&msg=${msg}`) };
}

export type MessageFormState = { error: string; body: string; subject: string; attempt: number } | null;

export async function saveMessageTemplate(prev: MessageFormState, fd: FormData): Promise<MessageFormState> {
  await requireAdmin();
  const { key, channel, lang, back } = parseTemplateTarget(fd);
  const body = String(fd.get('body') ?? '').replace(/\r\n/g, '\n').trim();
  const subject = s(fd, 'subject');
  const fail = (error: string) => ({ error, body, subject, attempt: (prev?.attempt ?? 0) + 1 });
  if (!body) return fail('The message text is required.');
  if (body.length > (channel === 'EMAIL' ? 5000 : channel === 'SMS' ? 480 : 200)) return fail(`Too long for ${channel} (max ${channel === 'EMAIL' ? 5000 : channel === 'SMS' ? 480 : 200} characters).`);
  if (channel === 'EMAIL' && !subject) return fail('Email subject is required.');
  const allowed = TEMPLATE_VARS[key];
  const used = templateVars(`${subject} ${body}`);
  const unknown = used.filter((v) => !allowed.includes(v));
  if (unknown.length) return fail(`Unknown placeholder: ${unknown.map((v) => `{${v}}`).join(', ')}. Available here: ${allowed.map((v) => `{${v}}`).join(', ')}.`);
  // Without the code the OTP message is useless and nobody can log in.
  if (key === 'OTP' && !used.includes('code')) return fail('The OTP message must contain {code}.');
  const data = { subject: channel === 'EMAIL' ? subject : null, body, providerApproved: channel === 'SMS' && b(fd, 'providerApproved') };
  await db.messageTemplate.upsert({ where: { key_channel_lang: { key, channel, lang } }, create: { key, channel, lang, ...data }, update: data });
  revalidatePath('/admin/messages');
  return back('saved');
}

/** Deletes the stored template so the built-in default (src/lib/template-defaults.ts) is used again. */
export async function resetMessageTemplate(fd: FormData) {
  await requireAdmin();
  const { key, channel, lang, back } = parseTemplateTarget(fd);
  await db.messageTemplate.deleteMany({ where: { key, channel, lang } });
  revalidatePath('/admin/messages');
  back('reset');
}

export async function testSendTemplate(fd: FormData) {
  const admin = await requireAdmin();
  const { key, channel, lang, back } = parseTemplateTarget(fd);
  const rl = await rateLimit(`testsend:${admin.id}`, 10, 600);
  if (!rl.ok) back('test-limit');
  const to = channel === 'EMAIL' ? admin.email : channel === 'SMS' ? admin.phone : admin.id;
  if (!to) back('no-email');
  const vars = Object.fromEntries(TEMPLATE_VARS[key].map((v) => [v, SAMPLE_VARS[v] ?? v]));
  const ok = await sendMessage({ key, channel, to: to!, lang, vars, userId: admin.id });
  back(ok ? `sent-${channel.toLowerCase()}` : 'send-failed');
}

// ─── Translations & settings ─────────────────────────────────────────────────

export async function saveTranslation(fd: FormData) {
  await requireAdmin();
  const lang = s(fd, 'lang');
  const key = s(fd, 'key');
  const value = String(fd.get('value') ?? '').replace(/\r\n/g, '\n');
  const back = (msg: string) => redirect(`/admin/translations?lang=${encodeURIComponent(lang)}&q=${encodeURIComponent(s(fd, 'q'))}&msg=${msg}&key=${encodeURIComponent(key)}`);
  if (!isLocale(lang)) redirect('/admin/translations');
  const base = flatten(MESSAGES[lang])[key];
  if (base === undefined) back('unknown-key');
  if (!value.trim() || value === base) {
    await db.translationOverride.deleteMany({ where: { lang, key } });
    revalidatePath('/', 'layout');
    back('reset');
  }
  if (value.length > 2000) back('too-long');
  // Placeholders like {n} are filled in by the app; dropping or renaming one breaks that text.
  const need = templateVars(base).sort().join(',');
  const have = templateVars(value).sort().join(',');
  if (need !== have) back('placeholders');
  await db.translationOverride.upsert({ where: { lang_key: { lang, key } }, create: { lang, key, value }, update: { value } });
  revalidatePath('/', 'layout');
  back('saved');
}

export async function saveSettings(fd: FormData) {
  await requireAdmin();
  const back = (msg: string) => redirect(`/admin/settings?msg=${msg}`);
  const friendPct = n(fd, 'referralFriendPct') ?? -1;
  const rewardDays = n(fd, 'referralRewardDays') ?? -1;
  const supportPhone = s(fd, 'supportPhone');
  const supportEmail = s(fd, 'supportEmail');
  const telegram = s(fd, 'telegram');
  if (!Number.isInteger(friendPct) || friendPct < 0 || friendPct > 90) back('bad-pct');
  if (!Number.isInteger(rewardDays) || rewardDays < 0 || rewardDays > 365) back('bad-days');
  if (!/^\+?[\d\s()-]{7,20}$/.test(supportPhone)) back('bad-phone');
  if (!z.string().email().safeParse(supportEmail).success) back('bad-email');
  if (telegram && !/^@?[A-Za-z0-9_]{5,32}$/.test(telegram)) back('bad-telegram');
  const entries: [string, string | number][] = [
    ['referralFriendPct', friendPct],
    ['referralRewardDays', rewardDays],
    ['supportPhone', supportPhone],
    ['supportEmail', supportEmail],
    ['telegram', telegram ? (telegram.startsWith('@') ? telegram : `@${telegram}`) : ''],
  ];
  await db.$transaction(entries.map(([key, value]) => db.setting.upsert({ where: { key }, create: { key, value }, update: { value } })));
  revalidatePath('/', 'layout');
  back('saved');
}
