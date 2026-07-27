'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { supportMailtoHref } from '@/lib/support';

export function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="app-footer" aria-label={t('legal.footerLabel')}>
      <nav className="app-footer-links" aria-label={t('legal.footerNav')}>
        <Link href="/privacy">{t('legal.privacy')}</Link>
        <Link href="/terms">{t('legal.terms')}</Link>
        <Link href="/disclaimer">Disclaimer</Link>
        <a href={supportMailtoHref()}>{t('legal.support')}</a>
        <Link className="app-footer-more" href="/settings/support">More</Link>
      </nav>
      <p className="app-footer-copy muted">© {new Date().getFullYear()} Everitt Ventures</p>
    </footer>
  );
}
