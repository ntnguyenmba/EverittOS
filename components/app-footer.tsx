'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';

export function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="app-footer" aria-label={t('legal.footerLabel')}>
      <nav className="app-footer-links" aria-label={t('legal.footerNav')}>
        <Link href="/terms">{t('legal.terms')}</Link>
        <Link href="/privacy">{t('legal.privacy')}</Link>
        <Link href="/cookies">{t('legal.cookies')}</Link>
        <Link href="/security">{t('legal.security')}</Link>
      </nav>
      <p className="app-footer-copy muted">© {new Date().getFullYear()} Everitt Ventures</p>
    </footer>
  );
}
