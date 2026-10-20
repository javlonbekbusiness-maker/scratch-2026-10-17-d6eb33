import { requireAdmin } from '@/lib/session';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { PageHeader, Badge, inputSm } from '../ui';

const PAGE = 30;

export default async function QuestionsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where: Prisma.QuestionWhereInput = {
    ...(sp.category ? { categoryId: sp.category } : {}),
    ...(sp.topic ? { topicId: sp.topic } : {}),
    ...(sp.ticket ? { ticketNumber: Number(sp.ticket) } : {}),
    ...(sp.q ? { OR: [{ textUz: { contains: sp.q, mode: 'insensitive' } }, { textRu: { contains: sp.q, mode: 'insensitive' } }, { externalId: sp.q }] } : {}),
  };
  const [rows, total, cats, topics] = await Promise.all([
    db.question.findMany({ where, include: { category: true, topic: true, _count: { select: { answers: true } } }, orderBy: [{ ticketNumber: 'asc' }, { sortOrder: 'asc' }], skip: (page - 1) * PAGE, take: PAGE }),
    db.question.count({ where }),
    db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.topic.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);
  const qs = (p: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v) as [string, string][]), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Questions"
        desc={`${total} questions. Content must come from an official or licensed question bank.`}
        actions={<>
          <Link href="/admin/import" className="btn-secondary btn-sm">⬆️ Bulk import</Link>
          <Link href="/admin/questions/new" className="btn-primary btn-sm">+ New question</Link>
        </>}
      />
      {sp.saved && <p className="mb-4 rounded-xl bg-mint-500/10 px-3 py-2 text-sm text-mint-700">Saved.</p>}
      <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-5">
        <input name="q" defaultValue={sp.q} placeholder="Search text or external ID" className={`${inputSm} sm:col-span-2`} />
        <select name="category" defaultValue={sp.category ?? ''} className={inputSm}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
        <select name="topic" defaultValue={sp.topic ?? ''} className={inputSm}>
          <option value="">All topics</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.nameUz}</option>)}
        </select>
        <div className="flex gap-2">
          <input name="ticket" type="number" min={1} defaultValue={sp.ticket} placeholder="Ticket" className={inputSm} />
          <button className="btn-primary btn-sm">Filter</button>
        </div>
      </form>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>#</th><th>Question (uz)</th><th>Cat</th><th>Ticket</th><th>Topic</th><th>Img</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id}>
                <td className="font-mono text-xs muted">{q.externalId ?? q.id.slice(-6)}</td>
                <td className="max-w-lg"><Link href={`/admin/questions/${q.id}`} className="font-medium hover:underline">{q.textUz.slice(0, 110)}</Link></td>
                <td>{q.category?.code ?? <span className="muted">all</span>}</td>
                <td>{q.ticketNumber ?? '—'}</td>
                <td>{q.topic?.nameUz ?? '—'}</td>
                <td>{q.imageUrl ? '🖼' : ''}</td>
                <td>{q.isActive ? <Badge tone="green">active</Badge> : <Badge>hidden</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="muted">Page {page} of {Math.max(1, Math.ceil(total / PAGE))}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={qs(page - 1)} className="btn-secondary btn-sm">← Prev</Link>}
          {page * PAGE < total && <Link href={qs(page + 1)} className="btn-secondary btn-sm">Next →</Link>}
        </div>
      </div>
    </>
  );
}
