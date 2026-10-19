import Link from 'next/link';
import { getT } from '@/i18n/server';
import { getSettings } from '@/lib/settings';
import { Logo } from './Logo';
import { Icon } from './ui/Icon';

export async function SiteFooter() {
  const [{ t }, s] = await Promise.all([getT(), getSettings()]);
  const link = 'inline-flex min-h-[40px] items-center gap-2 text-muted hover:text-ink';
  return (
    <footer className="mt-16 border-t border-line bg-surface py-10">
      <div className="container-app grid gap-8 sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-small text-muted">{t('landing.disclaimer')}</p>
        </div>
        <div>
          <h2 className="text-title">{t('landing.footerContacts')}</h2>
          <ul className="mt-2 text-sm">
            <li><a href={`tel:${s.supportPhone.replace(/\s/g, '')}`} className={link}><Icon name="phone" size={18} /> <span className="num">{s.supportPhone}</span></a></li>
            <li><a href={`mailto:${s.supportEmail}`} className={link}><Icon name="mail" size={18} /> {s.supportEmail}</a></li>
            <li className={link}><Icon name="send" size={18} /> Telegram: {s.telegram}</li>
          </ul>
        </div>
        <nav aria-label={t('landing.footerContacts')}>
          <ul className="text-sm">
            <li><Link href="/pricing" className={link}>{t('nav.pricing')}</Link></li>
            <li><Link href="/library" className={link}>{t('nav.library')}</Link></li>
            <li><Link href="/privacy" className={link}>{t('legal.privacyTitle')}</Link></li>
            <li><Link href="/terms" className={link}>{t('legal.termsTitle')}</Link></li>
          </ul>
        </nav>
      </div>
      <p className="container-app mt-8 text-xs text-muted">© {new Date().getFullYear()} YHQ Test. {t('landing.footerRights')}</p>
    </footer>
  );
}
