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
      <style jsx global>{`
        .app-footer {
          width: 100% !important;
          margin: 24px 0 0 !important;
          padding: 0 0 calc(14px + env(safe-area-inset-bottom)) !important;
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: #172033 !important;
        }
        .app-footer-inner {
          width: 100% !important;
          box-sizing: border-box !important;
          padding: 13px 2px 0 !important;
          border-top: 1px solid #d7e0ea !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px 18px !important;
        }
        .app-footer-links {
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          gap: 7px !important;
          margin: 0 !important;
          padding: 0 !important;
          color: #7c8798 !important;
        }
        .app-footer-links a,
        .app-footer-copy {
          color: #344154 !important;
          font-size: 12px !important;
          line-height: 1.45 !important;
        }
        .app-footer-links a {
          font-weight: 650 !important;
          text-decoration: none !important;
        }
        .app-footer-copy {
          margin: 0 !important;
          font-weight: 500 !important;
          white-space: nowrap !important;
        }
        .app-footer-links a:hover,
        .app-footer-links a:focus-visible {
          color: #234a84 !important;
        }
        .app-footer-links a:focus-visible {
          outline: 2px solid #4f7cc4 !important;
          outline-offset: 3px !important;
          border-radius: 3px !important;
        }
        @media (max-width: 700px) {
          .app-footer {
            margin-top: 18px !important;
            padding-bottom: calc(10px + env(safe-area-inset-bottom)) !important;
          }
          .app-footer-inner {
            padding-top: 12px !important;
            flex-direction: column !important;
            justify-content: center !important;
            gap: 7px !important;
            text-align: center !important;
          }
          .app-footer-links {
            width: 100% !important;
            justify-content: center !important;
            gap: 8px !important;
          }
          .app-footer-links a,
          .app-footer-copy {
            color: #243f53 !important;
            font-size: 12px !important;
          }
        }
      `}</style>
    </footer>
  );
}
