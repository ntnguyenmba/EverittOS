'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { supportMailtoHref, SUPPORT_EMAIL } from '@/lib/support';

export function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="app-footer" aria-label={t('legal.footerLabel')}>
      <nav className="app-footer-links" aria-label={t('legal.footerNav')}>
        <Link href="/terms">{t('legal.terms')}</Link>
        <Link href="/privacy">{t('legal.privacy')}</Link>
        <Link href="/cookies">{t('legal.cookies')}</Link>
        <Link href="/security">{t('legal.security')}</Link>
        <a href={supportMailtoHref()}>{t('legal.support')}</a>
      </nav>
      <p className="app-footer-copy muted">
        © {new Date().getFullYear()} Everitt Ventures ·{' '}
        <a href={supportMailtoHref()}>{SUPPORT_EMAIL}</a>
      </p>
    </footer>
  );
}
