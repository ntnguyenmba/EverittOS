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
        <span aria-hidden="true">·</span>
        <Link href="/terms">{t('legal.terms')}</Link>
        <span aria-hidden="true">·</span>
        <a href={supportMailtoHref()}>{t('legal.support')}</a>
      </nav>
      <p className="app-footer-copy">© {new Date().getFullYear()} Everitt Ventures</p>
      <style jsx global>{`
        .app-footer {
          width: 100% !important;
          max-width: 100% !important;
          margin: 28px auto 0 !important;
          padding: 20px 22px !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px 24px !important;
          border: 1px solid rgba(23,48,68,.14) !important;
          border-radius: 18px !important;
          background: rgba(255,255,255,.96) !important;
          color: #173044 !important;
          box-shadow: 0 8px 26px rgba(15,34,48,.08) !important;
          backdrop-filter: blur(10px) !important;
          -webkit-backdrop-filter: blur(10px) !important;
        }
        .app-footer-links {
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          gap: 8px 12px !important;
          margin: 0 !important;
          padding: 0 !important;
          color: #173044 !important;
        }
        .app-footer-links a,
        .app-footer-links span,
        .app-footer-copy {
          color: #173044 !important;
          opacity: 1 !important;
          text-shadow: none !important;
        }
        .app-footer-links a {
          font-weight: 700 !important;
          text-decoration: none !important;
        }
        .app-footer-links a:hover,
        .app-footer-links a:focus-visible {
          text-decoration: underline !important;
          text-underline-offset: 3px !important;
        }
        .app-footer-copy {
          margin: 0 !important;
          font-weight: 600 !important;
          line-height: 1.4 !important;
        }
        @media (max-width: 700px) {
          .app-footer {
            margin-top: 22px !important;
            padding: 18px 20px !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
          }
          .app-footer-links {
            justify-content: center !important;
          }
        }
      `}</style>
    </footer>
  );
}
