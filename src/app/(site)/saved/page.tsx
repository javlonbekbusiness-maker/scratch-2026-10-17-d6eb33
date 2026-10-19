import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { Icon } from '@/components/ui/Icon';
import { ButtonLink, EmptyState, SectionHeader } from '@/components/ui/Primitives';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('shell.saved'), robots: { index: false } };
}

export default async function SavedPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const [bookmarks, notes] = await Promise.all([
    db.bookmark.findMany({ where: { userId: user.id }, include: { question: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.note.findMany({ where: { userId: user.id }, include: { question: true }, orderBy: { updatedAt: 'desc' }, take: 100 }),
  ]);

  return (
    <div className="page space-y-4">
      <h1 className="text-h1">{t('shell.saved')}</h1>

      <section className="card p-5" aria-labelledby="bm-h">
        <SectionHeader id="bm-h" title={`${t('profile.bookmarks')} (${bookmarks.length})`} />
        {bookmarks.length === 0 ? (
          <EmptyState icon="bookmark" title={t('profile.emptyBookmarks')} text={t('saved.bookmarkHint')} action={<ButtonLink href="/tests" variant="secondary" icon="play">{t('dashboard.practice')}</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-line">
            {bookmarks.map((b) => (
              <li key={b.id} className="flex items-start gap-3 py-3">
                <Icon name="bookmark" size={18} className="mt-0.5 text-brand-fg" />
                <p className="flex-1">{pick(b.question, 'text', locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" aria-labelledby="notes-h">
        <SectionHeader id="notes-h" title={`${t('profile.notes')} (${notes.length})`} />
        {notes.length === 0 ? (
          <EmptyState icon="note" title={t('profile.emptyNotes')} text={t('saved.noteHint')} />
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="card-raised p-4">
                <p className="font-medium">{pick(n.question, 'text', locale)}</p>
                <p className="mt-2 whitespace-pre-line text-small text-muted">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
