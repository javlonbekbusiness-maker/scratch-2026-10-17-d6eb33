import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getT } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('leaderboard.title') };
}
export const revalidate = 300;

export default async function Leaderboard() {
  const [{ t }, me] = await Promise.all([getT(), getCurrentUser()]);
  const since = new Date(Date.now() - 7 * 86400_000);
  const rows = await db.$queryRaw<{ id: string; nickname: string | null; correct: bigint }[]>`
    SELECT u.id, u.nickname, COUNT(*) FILTER (WHERE a."isCorrect") AS correct
    FROM "SessionAnswer" a
    JOIN "TestSession" s ON s.id = a."sessionId"
    JOIN "User" u ON u.id = s."userId"
    WHERE a."createdAt" >= ${since} AND u."leaderboardOptIn" = true
    GROUP BY u.id, u.nickname
    ORDER BY correct DESC
    LIMIT 50`;

  return (
    <div className="container-app max-w-2xl py-8">
      <h1 className="text-3xl font-extrabold">🏆 {t('leaderboard.title')}</h1>
      <p className="mt-1 muted">{t('leaderboard.subtitle')}</p>
      {me && !me.leaderboardOptIn && <Link href="/profile" className="btn-secondary btn-sm mt-3">{t('profile.leaderboardOptIn')}</Link>}
      {rows.length === 0 ? (
        <p className="card mt-6 p-6 text-center muted">{t('leaderboard.empty')}</p>
      ) : (
        <ol className="card mt-6 divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r, i) => (
            <li key={r.id} className={`flex items-center gap-4 px-5 py-3 ${r.id === me?.id ? 'bg-brand-50 dark:bg-brand-950/50' : ''}`}>
              <span className="w-8 text-center text-lg font-extrabold">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
              <span className="flex-1 font-semibold">
                {r.nickname ?? 'Haydovchi'}
                {r.id === me?.id && <span className="chip ml-2 bg-brand-600 text-white">{t('leaderboard.you')}</span>}
              </span>
              <span className="tabular-nums"><b>{Number(r.correct)}</b> <span className="text-xs muted">{t('leaderboard.correctAnswers')}</span></span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
