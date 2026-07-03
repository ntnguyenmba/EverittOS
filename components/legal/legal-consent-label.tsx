'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';

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
      By continuing, you agree to the{' '}
      <Link href="/terms" className="legal-inline-link">
        {t('legal.termsOfService')}
      </Link>
      , acknowledge our{' '}
      <Link href="/privacy" className="legal-inline-link">
        {t('legal.privacyPolicy')}
      </Link>
      , and accept our{' '}
      <Link href="/cookies" className="legal-inline-link">
        Cookies
      </Link>{' '}
      and{' '}
      <Link href="/security" className="legal-inline-link">
        Security
      </Link>{' '}
      practices.
    </p>
  );
}

/** Secondary legal links for auth pages. */
export function AuthLegalFooterLinks() {
  return null;
}
