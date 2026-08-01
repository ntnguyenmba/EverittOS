'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';
import { supportMailtoHref } from '@/lib/support';

type LegalConsentLabelProps = {
  idPrefix?: string;
  id?: string;
};

/** Inline consent copy with Terms and Privacy links; wraps naturally on narrow screens. */
export function LegalConsentLabel({ idPrefix = 'legal-consent', id }: LegalConsentLabelProps) {
  const { t } = useTranslation();

  return (
    <span id={id} className="legal-consent-text">
      {t('auth.agreeToTermsPrefix')}{' '}
      <Link id={`${idPrefix}-terms`} href="/terms" className="legal-inline-link">
        {t('legal.termsOfService')}
      </Link>{' '}
      <span className="legal-consent-tail">
        {t('auth.agreeToTermsAnd')}{' '}
        <Link id={`${idPrefix}-privacy`} href="/privacy" className="legal-inline-link">
          {t('legal.privacyPolicy')}
        </Link>
      </span>
    </span>
  );
}

/** Post-form note for auth pages without an explicit consent checkbox. */
export function AuthContinuingLegalNote() {
  const { t } = useTranslation();

  return (
    <p className="auth-legal-note">
      {t('auth.continuingLegalPrefix')}{' '}
      <Link href="/terms" className="legal-inline-link">
        {t('legal.termsOfService')}
      </Link>
      {t('auth.continuingLegalAcknowledge')}{' '}
      <Link href="/privacy" className="legal-inline-link">
        {t('legal.privacyPolicy')}
      </Link>
      .
    </p>
  );
}

/** Store-review and legal links for public authentication pages. */
export function AuthLegalFooterLinks() {
  const { t, locale } = useTranslation();
  const additionalCopy = {
    en: { support: 'Support', accountDeletion: 'Account deletion' },
    es: { support: 'Soporte', accountDeletion: 'Eliminar cuenta' },
    vi: { support: 'Hỗ trợ', accountDeletion: 'Xóa tài khoản' }
  };
  const copy = additionalCopy[locale] || additionalCopy.en;
  const links = [
    { href: '/terms', label: t('legal.termsOfService') },
    { href: '/privacy', label: t('legal.privacyPolicy') },
    { href: '/cookies', label: t('legal.cookies') },
    { href: '/security', label: t('legal.security') },
    { href: supportMailtoHref(), label: copy.support },
    { href: '/account-deletion', label: copy.accountDeletion }
  ];

  return (
    <nav className="auth-legal-footer" aria-label={t('legal.footerNav')}>
      {links.map((link, index) => (
        <span key={link.href}>
          {index > 0 ? (
            <span className="auth-legal-footer-sep" aria-hidden="true">
              {' '}
              ·{' '}
            </span>
          ) : null}
          <Link href={link.href}>{link.label}</Link>
        </span>
      ))}
    </nav>
  );
}
