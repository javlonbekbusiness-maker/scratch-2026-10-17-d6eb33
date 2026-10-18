import Link from 'next/link';
import { getT } from '@/i18n/server';
import { getSettings } from '@/lib/settings';
import { Logo } from './Logo';

export async function SiteFooter() {
  const [{ t }, s] = await Promise.all([getT(), getSettings()]);
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-900">
      <div className="container-app grid gap-8 sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm muted">{t('landing.disclaimer')}</p>
        </div>
        <div>
          <h2 className="font-semibold">{t('landing.footerContacts')}</h2>
          <ul className="mt-3 space-y-2 text-sm muted">
            <li><a href={`tel:${s.supportPhone.replace(/\s/g, '')}`} className="hover:underline">📞 {s.supportPhone}</a></li>
            <li><a href={`mailto:${s.supportEmail}`} className="hover:underline">✉️ {s.supportEmail}</a></li>
            <li>💬 Telegram: {s.telegram}</li>
          </ul>
        </div>
        <div>
          <ul className="space-y-2 text-sm">
            <li><Link href="/pricing" className="hover:underline">{t('nav.pricing')}</Link></li>
            <li><Link href="/library" className="hover:underline">{t('nav.library')}</Link></li>
            <li><Link href="/privacy" className="hover:underline">{t('legal.privacyTitle')}</Link></li>
            <li><Link href="/terms" className="hover:underline">{t('legal.termsTitle')}</Link></li>
          </ul>
        </div>
      </div>
      <p className="container-app mt-8 text-xs muted">© {new Date().getFullYear()} YHQ Test. {t('landing.footerRights')}</p>
    </footer>
  );
}
