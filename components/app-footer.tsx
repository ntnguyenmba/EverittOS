'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { supportMailtoHref } from '@/lib/support';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { CLIENT_PORTAL_SETTINGS, CONTRACTOR_PORTAL_SETTINGS } from '@/lib/portal-access';

const deleteAccountLabel = {
  en: 'Delete account',
  es: 'Eliminar cuenta',
  vi: 'Xóa tài khoản'
} as const;

export function AppFooter() {
  const { t, locale } = useTranslation();
  const workspace = useWorkspacePlanOptional();
  const role = normalizeRole(workspace?.role);
  const accountHref = isContractorRole(role)
    ? CONTRACTOR_PORTAL_SETTINGS
    : isClientRole(role)
      ? CLIENT_PORTAL_SETTINGS
      : '/settings/account';

  return (
    <footer className="app-footer" aria-label={t('legal.footerLabel')}>
      <nav className="app-footer-links" aria-label={t('legal.footerNav')}>
        <Link href="/privacy">{t('legal.privacy')}</Link>
        <Link href="/terms">{t('legal.terms')}</Link>
        <a href={supportMailtoHref()}>{t('legal.support')}</a>
        <Link href={accountHref}>{deleteAccountLabel[locale]}</Link>
      </nav>
      <p className="app-footer-copy muted">© {new Date().getFullYear()} Everitt Ventures</p>
    </footer>
  );
}
