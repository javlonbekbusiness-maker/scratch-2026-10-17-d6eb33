import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { formatPhone } from '@/lib/phone';
import { logout, logoutEverywhere } from '@/app/actions';
import { LangSwitcher, ThemeToggle } from '@/components/HeaderControls';
import { Icon } from '@/components/ui/Icon';
import { ListRow, SectionHeader } from '@/components/ui/Primitives';
import { ProfileForm } from '../profile/ProfileForm';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('shell.settings'), robots: { index: false } };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const cats = await db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });

  return (
    <div className="page max-w-3xl space-y-4">
      <h1 className="text-h1">{t('shell.settings')}</h1>

      <section className="card divide-y divide-line overflow-hidden" aria-label={t('settings.appearance')}>
        <ListRow icon="globe" title={t('common.language')} trailing={<LangSwitcher />} />
        <ListRow icon="moon" title={t('settings.theme')} subtitle={t('settings.themeHint')} trailing={<ThemeToggle />} />
      </section>

      <section className="card p-5" aria-labelledby="me-h">
        <SectionHeader id="me-h" title={t('profile.personal')} />
        <p className="text-small text-muted">{formatPhone(user.phone)}</p>
        <ProfileForm
          user={{ name: user.name ?? '', email: user.email ?? '', categoryId: user.categoryId ?? '', remindSms: user.remindSms, remindEmail: user.remindEmail, remindPush: user.remindPush, leaderboardOptIn: user.leaderboardOptIn }}
          categories={cats.map((c) => ({ id: c.id, label: `${c.code} — ${pick(c, 'name', locale)}` }))}
        />
      </section>

      <section className="card divide-y divide-line overflow-hidden" aria-label={t('shell.account')}>
        <ListRow icon="user" title={t('profile.title')} subtitle={t('settings.profileHint')} href="/profile" />
        <ListRow icon="card" title={t('nav.pricing')} href="/pricing" />
        <ListRow icon="trophy" title={t('nav.leaderboard')} href="/leaderboard" />
        <ListRow icon="book" title={t('nav.library')} href="/library" />
        {user.role === 'ADMIN' && <ListRow icon="shield" title={t('nav.admin')} href="/admin" />}
        <ListRow icon="shield" title={t('legal.privacyTitle')} href="/privacy" />
        <ListRow icon="note" title={t('legal.termsTitle')} href="/terms" />
      </section>

      <section className="card p-5" aria-labelledby="sec-h">
        <SectionHeader id="sec-h" title={t('profile.security')} />
        <p className="text-small text-muted">{t('profile.logoutAllHint')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={logout}>
            <button className="btn-secondary"><Icon name="logout" size={20} />{t('common.logout')}</button>
          </form>
          <form action={logoutEverywhere}>
            <button className="btn-ghost text-danger hover:text-danger">{t('profile.logoutAll')}</button>
          </form>
        </div>
      </section>
    </div>
  );
}
