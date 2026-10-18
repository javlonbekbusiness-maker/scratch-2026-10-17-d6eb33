import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser, requireAdmin } from '@/lib/session';
import { userStats } from '@/lib/stats';
import { formatDate, formatUzs } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { providerLabel } from '@/lib/payments';
import { grantUserDays, revokeAccess, setUserRole } from '../../actions';
import { Badge, PageHeader, Stat, inputSm } from '../../ui';
import { ConfirmButton } from '../../ConfirmButton';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, [string, 'ok' | 'warn' | 'err']> = {
  revoked: ['Access revoked. The user now sees the free plan.', 'ok'],
  'nothing-to-revoke': ['This user has no active access to revoke.', 'warn'],
  'bad-days': ['Days must be a whole number from 1 to 3650.', 'err'],
  'made-admin': ['User is now an admin.', 'ok'],
  'made-user': ['Admin rights removed.', 'ok'],
  'self-role': ['You cannot change your own role.', 'err'],
  'last-admin': ['This is the last admin; make someone else admin first.', 'err'],
  'bad-role': ['Unknown role.', 'err'],
};
const TONE = { ok: 'bg-mint-500/10 text-mint-700', warn: 'bg-amber-100 text-amber-800', err: 'bg-red-500/10 text-red-700' };
const SOURCE_LABEL: Record<string, string> = { PAYMENT: 'Payment', ADMIN: 'Granted by admin', TRIAL: 'Free trial', REFERRAL: 'Referral reward', PROMO: 'Promo' };

export default async function UserDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const [{ id }, sp, me] = await Promise.all([params, searchParams, getCurrentUser()]);
  const user = await db.user.findUnique({ where: { id }, include: { category: true, referredBy: true } });
  if (!user) notFound();
  const now = new Date();
  const [subs, payments, stats, tests, invited, rewards, messages] = await Promise.all([
    db.subscription.findMany({ where: { userId: id }, include: { plan: true }, orderBy: { expiresAt: 'desc' } }),
    db.payment.findMany({ where: { userId: id }, include: { plan: true, promoCode: true }, orderBy: { createdAt: 'desc' }, take: 30 }),
    userStats(id, user.categoryId),
    db.testSession.count({ where: { userId: id, finishedAt: { not: null } } }),
    db.user.count({ where: { referredById: id } }),
    db.referralReward.count({ where: { referrerId: id } }),
    db.messageLog.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  const activeUntil = subs.find((s) => s.expiresAt > now)?.expiresAt ?? null;
  const paidTotal = payments.filter((p) => p.status === 'PAID').reduce((a, p) => a + p.finalAmountUzs, 0);
  const msg = sp.msg?.startsWith('granted-') ? ([`Added ${sp.msg.slice(8)} days of access.`, 'ok'] as const) : sp.msg ? MESSAGES[sp.msg] : undefined;
  const isSelf = me?.id === user.id;

  return (
    <>
      <PageHeader
        title={user.name || formatPhone(user.phone)}
        desc={`${formatPhone(user.phone)}${user.email ? ` · ${user.email}` : ''} · joined ${formatDate(user.createdAt)}`}
        actions={<Link href="/admin/users" className="btn-ghost btn-sm">← All users</Link>}
      />
      {msg && <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${TONE[msg[1]]}`}>{msg[0]}</p>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Access" value={activeUntil ? `until ${formatDate(activeUntil)}` : 'Free plan'} hint={user.passedAt ? `Reported passing on ${formatDate(user.passedAt)}` : undefined} />
        <Stat label="Paid in total" value={`${formatUzs(paidTotal)} so'm`} hint={`${payments.filter((p) => p.status === 'PAID').length} payments`} />
        <Stat label="Readiness" value={`${stats.readiness}%`} hint={`${stats.accuracy}% accuracy · ${stats.total} answers · ${tests} tests`} />
        <Stat label="Referrals" value={invited} hint={`${rewards} rewarded${user.referredBy ? ` · invited by ${user.referredBy.name ?? formatPhone(user.referredBy.phone)}` : ''}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5" aria-labelledby="grant-h">
          <h2 id="grant-h" className="font-bold">Grant access</h2>
          <p className="mb-3 text-sm muted">Adds days after any current access (they stack).</p>
          <form action={grantUserDays} className="flex flex-wrap gap-2">
            <input type="hidden" name="userId" value={user.id} />
            <label className="sr-only" htmlFor="days">Days</label>
            <input id="days" name="days" type="number" min={1} max={3650} required defaultValue={7} className={`${inputSm} w-28`} />
            <button className="btn-primary btn-sm">Add days</button>
          </form>
          <div className="mt-2 flex gap-1">
            {[3, 7, 30].map((d) => (
              <form key={d} action={grantUserDays}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="days" value={d} />
                <button className="btn-ghost btn-sm">+{d} days</button>
              </form>
            ))}
          </div>
        </section>

        <section className="card p-5" aria-labelledby="revoke-h">
          <h2 id="revoke-h" className="font-bold">Revoke access</h2>
          <p className="mb-3 text-sm muted">Ends the current period and any stacked future periods now. Payments are not refunded automatically.</p>
          <form action={revokeAccess}>
            <input type="hidden" name="userId" value={user.id} />
            <ConfirmButton message="Revoke all current and future access for this user?" className="btn-secondary btn-sm text-red-600">Revoke access</ConfirmButton>
          </form>
        </section>

        <section className="card p-5" aria-labelledby="role-h">
          <h2 id="role-h" className="font-bold">Role</h2>
          <p className="mb-3 text-sm muted">Admins can see all user data and change content and prices.</p>
          {isSelf ? (
            <p className="text-sm"><Badge tone="amber">admin</Badge> <span className="muted">This is you; another admin must change your role.</span></p>
          ) : (
            <form action={setUserRole} className="flex gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="role" value={user.role === 'ADMIN' ? 'USER' : 'ADMIN'} />
              <span className="self-center">{user.role === 'ADMIN' ? <Badge tone="amber">admin</Badge> : <Badge>user</Badge>}</span>
              <ConfirmButton
                message={user.role === 'ADMIN' ? 'Remove admin rights from this user?' : 'Give this user full admin access?'}
                className="btn-secondary btn-sm"
              >
                {user.role === 'ADMIN' ? 'Remove admin' : 'Make admin'}
              </ConfirmButton>
            </form>
          )}
        </section>
      </div>

      <section className="mt-6" aria-labelledby="subs-h">
        <h2 id="subs-h" className="mb-3 text-lg font-bold">Access periods</h2>
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Source</th><th>Plan</th><th>Starts</th><th>Ends</th><th>Status</th></tr></thead>
            <tbody>
              {subs.length === 0 && <tr><td colSpan={5} className="py-6 text-center muted">No access periods.</td></tr>}
              {subs.map((s) => {
                const st = s.expiresAt <= now ? 'ended' : s.startsAt > now ? 'upcoming' : 'current';
                return (
                  <tr key={s.id}>
                    <td>{SOURCE_LABEL[s.source] ?? s.source}</td>
                    <td>{s.plan?.labelUz ?? '—'}</td>
                    <td>{formatDate(s.startsAt)}</td>
                    <td>{formatDate(s.expiresAt)}</td>
                    <td><Badge tone={st === 'current' ? 'green' : st === 'upcoming' ? 'blue' : 'slate'}>{st}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6" aria-labelledby="pays-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="pays-h" className="text-lg font-bold">Payments</h2>
          <Link href={`/admin/payments?q=${encodeURIComponent(user.phone.replace('+', ''))}`} className="text-sm text-brand-600 hover:underline">Open in Payments →</Link>
        </div>
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Plan</th><th>Provider</th><th>Price</th><th>Discount</th><th>Paid</th><th>Code</th><th>Status</th></tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={8} className="py-6 text-center muted">No payments.</td></tr>}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>{p.plan.labelUz}</td>
                  <td>{providerLabel[p.provider]}</td>
                  <td className="tabular-nums">{formatUzs(p.amountUzs)}</td>
                  <td className="tabular-nums">{p.discountUzs ? `−${formatUzs(p.discountUzs)}` : '—'}</td>
                  <td className="font-semibold tabular-nums">{formatUzs(p.finalAmountUzs)}</td>
                  <td className="font-mono text-xs">{p.promoCode?.code ?? '—'}</td>
                  <td><Badge tone={p.status === 'PAID' ? 'green' : p.status === 'FAILED' ? 'red' : 'slate'}>{p.status.toLowerCase()}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-2 font-bold">Profile</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="muted">Category</dt><dd>{user.category?.code ?? '—'}</dd>
            <dt className="muted">Language</dt><dd>{user.locale}</dd>
            <dt className="muted">Consent</dt><dd>{user.consentAt ? formatDate(user.consentAt) : '—'}</dd>
            <dt className="muted">Reminders</dt><dd>{[user.remindSms && 'SMS', user.remindEmail && 'email', user.remindPush && 'push'].filter(Boolean).join(', ') || 'off'}</dd>
            <dt className="muted">Leaderboard</dt><dd>{user.leaderboardOptIn ? `yes (${user.nickname ?? '—'})` : 'no'}</dd>
            <dt className="muted">Referral code</dt><dd className="font-mono">{user.referralCode}</dd>
            <dt className="muted">Streak</dt><dd>{stats.streak} days</dd>
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="mb-2 font-bold">Recent messages</h2>
          {messages.length === 0 ? <p className="text-sm muted">None.</p> : (
            <ul className="space-y-1 text-sm">
              {messages.map((m) => (
                <li key={m.id} className="flex gap-2">
                  <span className="w-20 shrink-0 muted">{formatDate(m.createdAt)}</span>
                  <span className="w-14 shrink-0 text-xs font-semibold">{m.channel}</span>
                  <span className="truncate">{m.key}</span>
                  <Badge tone={m.status === 'SENT' ? 'green' : 'red'}>{m.status.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
