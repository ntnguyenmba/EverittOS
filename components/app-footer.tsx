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
        .app-footer{width:100%!important;max-width:100%!important;margin:28px auto 0!important;padding:14px 2px calc(14px + env(safe-area-inset-bottom))!important;box-sizing:border-box!important;display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:space-between!important;gap:10px 20px!important;border:0!important;border-top:1px solid rgba(37,54,74,.12)!important;border-radius:0!important;background:transparent!important;color:var(--muted,#5b667a)!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
        .app-footer-links{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:8px 16px!important;margin:0!important;padding:0!important}.app-footer-links a,.app-footer-copy{color:var(--muted,#5b667a)!important;font-size:12px!important;line-height:1.4!important}.app-footer-links a{font-weight:650!important;text-decoration:none!important}.app-footer-links a:hover,.app-footer-links a:focus-visible{color:var(--text,#172033)!important;text-decoration:underline!important;text-underline-offset:3px!important}.app-footer-copy{margin:0!important;font-weight:550!important}
        @media(max-width:700px){.app-footer{margin-top:22px!important;align-items:center!important;justify-content:center!important;text-align:center!important}.app-footer-links{justify-content:center!important}}
      `}</style>
    </footer>
  );
}
