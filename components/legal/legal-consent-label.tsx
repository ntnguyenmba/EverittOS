'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';

type LegalConsentLabelProps = {
  /** Optional id prefix for link elements (accessibility). */
  idPrefix?: string;
  className?: string;
};

/** Checkbox label: “I agree to the [Terms of Service] and [Privacy Policy]”. */
export function LegalConsentLabel({ idPrefix = 'legal-consent', className }: LegalConsentLabelProps) {
  const { t } = useTranslation();

  return (
    <span className={className}>
      {t('auth.agreeToTermsPrefix')}{' '}
      <Link
        id={`${idPrefix}-terms`}
        href="/terms"
        className="legal-inline-link"
      >
        {t('legal.termsOfService')}
      </Link>{' '}
      {t('auth.agreeToTermsAnd')}{' '}
      <Link
        id={`${idPrefix}-privacy`}
        href="/privacy"
        className="legal-inline-link"
      >
        {t('legal.privacyPolicy')}
      </Link>
    </span>
  );
}

/** Auth footer note with inline Terms, Privacy, and Refund Policy links. */
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
      {t('auth.continuingLegalUnderstand')}{' '}
      <Link href="/refund-policy" className="legal-inline-link">
        {t('legal.refundPolicy')}
      </Link>
      .
    </p>
  );
}

/** Compact legal links for auth page footers. */
export function AuthLegalFooterLinks() {
  const { t } = useTranslation();

  return (
    <p>
      <Link href="/terms" className="legal-inline-link">
        {t('legal.termsOfService')}
      </Link>{' '}
      ·{' '}
      <Link href="/privacy" className="legal-inline-link">
        {t('legal.privacyPolicy')}
      </Link>{' '}
      · <Link href="/refund-policy">{t('legal.refundPolicy')}</Link> · <Link href="/cookies">{t('legal.cookies')}</Link>{' '}
      · <Link href="/security">{t('legal.security')}</Link>
    </p>
  );
}
