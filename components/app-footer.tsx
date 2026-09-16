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
        <a href={supportMailtoHref()}>{t('legal.support')}</a>
      </nav>
      <p className="app-footer-copy">© {new Date().getFullYear()} Everitt Ventures</p>
      <style jsx global>{`
        .app-footer{width:100%!important;max-width:100%!important;margin:28px auto 0!important;padding:14px 16px calc(14px + env(safe-area-inset-bottom))!important;box-sizing:border-box!important;display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:space-between!important;gap:10px 20px!important;border:1px solid #d7e0e7!important;border-radius:14px!important;background:rgba(255,255,255,.97)!important;color:#243f53!important;box-shadow:0 8px 24px rgba(19,36,51,.10)!important;backdrop-filter:blur(10px)!important;-webkit-backdrop-filter:blur(10px)!important}
        .app-footer-links{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:8px 16px!important;margin:0!important;padding:0!important}.app-footer-links a,.app-footer-copy{color:#243f53!important;font-size:12px!important;line-height:1.4!important}.app-footer-links a{font-weight:700!important;text-decoration:none!important}.app-footer-links a:hover,.app-footer-links a:focus-visible{color:#132433!important;text-decoration:underline!important;text-underline-offset:3px!important}.app-footer-links a:focus-visible{outline:2px solid #285d78!important;outline-offset:3px!important;border-radius:4px!important}.app-footer-copy{margin:0!important;font-weight:600!important}
        @media(max-width:700px){.app-footer{margin-top:22px!important;padding:14px 14px calc(16px + env(safe-area-inset-bottom))!important;align-items:center!important;justify-content:center!important;text-align:center!important}.app-footer-links{justify-content:center!important}}
      `}</style>
    </footer>
  );
}
