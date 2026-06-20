'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';

type LegalConsentLabelProps = {
  /** Optional id prefix for link elements (accessibility). */
  idPrefix?: string;
  className?: string;
  id?: string;
};

/**
 * Checkbox label:
 *   I agree to the Terms of Service
 *   and Privacy Policy
 * Two lines on narrow viewports; one line when space allows.
 */
export function LegalConsentLabel({ idPrefix = 'legal-consent', className, id }: LegalConsentLabelProps) {
  const { t } = useTranslation();

  return (
    <span id={id} className={['legal-consent-copy', className].filter(Boolean).join(' ')}>
      <span className="legal-consent-line">
        {t('auth.agreeToTermsPrefix')}{' '}
        <Link id={`${idPrefix}-terms`} href="/terms" className="legal-inline-link">
          {t('legal.termsOfService')}
        </Link>
      </span>
      <span className="legal-consent-line legal-consent-line-second">
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
      {t('auth.continuingLegalUnderstand')}{' '}
      <Link href="/refund-policy" className="legal-inline-link">
        {t('legal.refundPolicy')}
      </Link>
      .
    </p>
  );
}

/** Secondary legal links — excludes Terms/Privacy when shown in consent or continuing note. */
export function AuthLegalFooterLinks() {
  const { t } = useTranslation();

  return (
    <nav className="auth-legal-footer" aria-label={t('legal.footerNav')}>
      <Link href="/refund-policy">{t('legal.refundPolicy')}</Link>
      <span className="auth-legal-footer-sep" aria-hidden="true">
        ·
      </span>
      <Link href="/cookies">{t('legal.cookies')}</Link>
      <span className="auth-legal-footer-sep" aria-hidden="true">
        ·
      </span>
      <Link href="/security">{t('legal.security')}</Link>
    </nav>
  );
}
