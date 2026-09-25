'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { supportMailtoHref } from '@/lib/support';

export function AppFooter() {
  const { t } = useTranslation();
  return (
    <footer className="app-footer" aria-label={t('legal.footerLabel')}>
      <div className="app-footer-inner">
        <nav className="app-footer-links" aria-label={t('legal.footerNav')}>
          <Link href="/privacy">{t('legal.privacy')}</Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms">{t('legal.terms')}</Link>
          <span aria-hidden="true">·</span>
          <a href={supportMailtoHref()}>{t('legal.support')}</a>
        </nav>
        <p className="app-footer-copy">© {new Date().getFullYear()} Everitt Ventures</p>
      </div>
    </footer>
  );
}
