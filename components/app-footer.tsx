'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { supportMailtoHref } from '@/lib/support';

export function AppFooter() {
  const { t } = useTranslation();
  return (
    <footer className="app-footer" aria-label={t('legal.footerLabel')}>
      <div className="app-footer-inner">
        <p className="app-footer-copy">© {new Date().getFullYear()} Everitt Ventures</p>
        <nav className="app-footer-links" aria-label={t('legal.footerNav')}>
          <Link href="/privacy">{t('legal.privacy')}</Link>
          <Link href="/terms">{t('legal.terms')}</Link>
          <a href={supportMailtoHref()}>{t('legal.support')}</a>
        </nav>
      </div>
      <style jsx global>{`
        .app-footer {
          width: 100% !important;
          margin: 30px 0 0 !important;
          padding: 0 0 calc(18px + env(safe-area-inset-bottom)) !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          color: #5b667a !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .app-footer-inner {
          width: 100% !important;
          padding-top: 16px !important;
          border-top: 1px solid #e7eef7 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px 24px !important;
        }
        .app-footer-copy {
          margin: 0 !important;
          color: #7c8798 !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          line-height: 1.5 !important;
          letter-spacing: .01em !important;
        }
        .app-footer-links {
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 8px 18px !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .app-footer-links a {
          color: #5b667a !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          line-height: 1.5 !important;
          text-decoration: none !important;
          transition: color .16s ease !important;
        }
        .app-footer-links a:hover,
        .app-footer-links a:focus-visible {
          color: #234a84 !important;
          text-decoration: none !important;
        }
        .app-footer-links a:focus-visible {
          outline: 2px solid #4f7cc4 !important;
          outline-offset: 3px !important;
          border-radius: 4px !important;
        }
        @media (max-width: 700px) {
          .app-footer {
            margin-top: 24px !important;
            padding-bottom: calc(20px + env(safe-area-inset-bottom)) !important;
          }
          .app-footer-inner {
            padding-top: 14px !important;
            flex-direction: column-reverse !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .app-footer-links {
            width: 100% !important;
            justify-content: flex-start !important;
            gap: 8px 16px !important;
          }
        }
      `}</style>
    </footer>
  );
}
