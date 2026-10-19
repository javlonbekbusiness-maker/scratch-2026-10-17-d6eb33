import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getT } from '@/i18n/server';
import { IconTile } from '@/components/ui/Cards';
import { EmptyState } from '@/components/ui/Primitives';

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

  // Top three get gold / silver / bronze rank badges (our colours, with the number for screen readers).
  const podium = ['bg-[#fbbf24] text-[#2b1d05]', 'bg-[#cbd5e1] text-[#0e1730]', 'bg-[#d97706] text-white'];
  return (
    <div className={me ? 'page max-w-2xl' : 'container-app max-w-2xl py-8'}>
      <div className="flex items-center gap-3">
        <IconTile icon="trophy" tone="warning" />
        <div>
          <h1 className="text-h1">{t('leaderboard.title')}</h1>
          <p className="text-small text-muted">{t('leaderboard.subtitle')}</p>
        </div>
      </div>
      {me && !me.leaderboardOptIn && <Link href="/settings" className="btn-secondary mt-4">{t('profile.leaderboardOptIn')}</Link>}
      {rows.length === 0 ? (
        <div className="card mt-5"><EmptyState icon="trophy" title={t('leaderboard.empty')} /></div>
      ) : (
        <ol className="card mt-5 divide-y divide-line overflow-hidden">
          {rows.map((r, i) => (
            <li key={r.id} className={`flex min-h-[60px] items-center gap-4 px-4 py-2 ${r.id === me?.id ? 'bg-brand-600/10' : ''}`}>
              <span className={`num grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${podium[i] ?? 'bg-raised text-muted'}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {r.nickname ?? 'Haydovchi'}
                {r.id === me?.id && <span className="chip ml-2 bg-brand-600 text-white">{t('leaderboard.you')}</span>}
              </span>
              <span className="num text-right"><b>{Number(r.correct)}</b> <span className="block text-xs text-muted sm:inline">{t('leaderboard.correctAnswers')}</span></span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
