import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { formatDate, formatUzs } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { Badge, PageHeader, Stat, inputSm } from '../ui';

export const dynamic = 'force-dynamic';
const PAGE = 50;

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const now = new Date();
  const q = sp.q?.trim();
  const digits = q?.replace(/\D/g, '') ?? '';
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []), { id: q }] } : {}),
    ...(sp.role === 'ADMIN' || sp.role === 'USER' ? { role: sp.role } : {}),
    ...(sp.access === 'active' ? { subscriptions: { some: { expiresAt: { gt: now } } } } : sp.access === 'none' ? { subscriptions: { none: { expiresAt: { gt: now } } } } : {}),
    ...(sp.category ? { categoryId: sp.category } : {}),
  };

  const [users, total, cats, allUsers, activeUsers, admins] = await Promise.all([
    db.user.findMany({
      where,
      include: { category: true, subscriptions: { where: { expiresAt: { gt: now } }, orderBy: { expiresAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    db.user.count({ where }),
    db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.user.count(),
    db.user.count({ where: { subscriptions: { some: { expiresAt: { gt: now } } } } }),
    db.user.count({ where: { role: 'ADMIN' } }),
  ]);
  const paid = await db.payment.groupBy({ by: ['userId'], where: { status: 'PAID', userId: { in: users.map((u) => u.id) } }, _sum: { finalAmountUzs: true }, _count: true });
  const paidBy = new Map(paid.map((p) => [p.userId, p]));
  const keep = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== 'page')) as Record<string, string>;
  const qs = (p: number) => `?${new URLSearchParams({ ...keep, page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Users"
        desc="Personal data: handle according to the privacy policy. Export only what you need."
        actions={<a href="/api/admin/export/users" className="btn-secondary btn-sm">⬇ Export users (CSV)</a>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Users" value={allUsers} />
        <Stat label="With active access" value={activeUsers} hint={allUsers ? `${Math.round((100 * activeUsers) / allUsers)}% of users` : undefined} />
        <Stat label="Admins" value={admins} />
      </div>

      <form className="card mb-3 grid gap-2 p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder="Name, phone, email or ID" className={inputSm} aria-label="Search users" />
        <select name="access" defaultValue={sp.access ?? ''} className={inputSm} aria-label="Access">
          <option value="">Any access</option>
          <option value="active">Active access</option>
          <option value="none">No access</option>
        </select>
        <select name="category" defaultValue={sp.category ?? ''} className={inputSm} aria-label="Category">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
        <select name="role" defaultValue={sp.role ?? ''} className={inputSm} aria-label="Role">
          <option value="">All roles</option>
          <option value="USER">Users</option>
          <option value="ADMIN">Admins</option>
        </select>
        <button className="btn-primary btn-sm">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>User</th><th>Phone</th><th>Category</th><th>Joined</th><th>Access until</th><th>Paid</th><th>Last active</th><th>Role</th></tr></thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={8} className="py-6 text-center muted">No users match.</td></tr>}
            {users.map((u) => {
              const sub = u.subscriptions[0];
              const p = paidBy.get(u.id);
              return (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/users/${u.id}`} className="font-semibold hover:underline">{u.name || <span className="muted">(no name)</span>}</Link>
                    {u.email && <p className="text-xs muted">{u.email}</p>}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">{formatPhone(u.phone)}</td>
                  <td>{u.category?.code ?? '—'}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>{sub ? <Badge tone="green">{formatDate(sub.expiresAt)}</Badge> : <span className="muted">—</span>}</td>
                  <td className="whitespace-nowrap tabular-nums">{p ? `${formatUzs(p._sum.finalAmountUzs ?? 0)} (${p._count})` : '—'}</td>
                  <td>{u.lastActiveAt ? formatDate(u.lastActiveAt) : '—'}</td>
                  <td>{u.role === 'ADMIN' ? <Badge tone="amber">admin</Badge> : <span className="text-xs muted">user</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="muted">{total} users · page {page} of {Math.max(1, Math.ceil(total / PAGE))}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={qs(page - 1)} className="btn-secondary btn-sm">← Prev</Link>}
          {page * PAGE < total && <Link href={qs(page + 1)} className="btn-secondary btn-sm">Next →</Link>}
        </div>
      </div>
    </>
  );
}
