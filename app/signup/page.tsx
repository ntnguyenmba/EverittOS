'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { LegalConsentLabel } from '@/components/legal/legal-consent-label';
import { NoRefundDisclosure } from '@/components/legal/no-refund-disclosure';
import { AuthMessages } from '@/components/auth/auth-messages';
import { authApiFetch } from '@/lib/auth-fetch';
import { safeNextPath } from '@/lib/app-url';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { mapAuthError } from '@/lib/auth-errors';
import { normalizeEmail } from '@/lib/input-validation';
import { parseFetchFailure, parseLoginApiResponse } from '@/lib/auth-request-error';
import { resolveClientApiUrl } from '@/lib/client-api-url';
import { OnboardingSupportPromo } from '@/components/onboarding-support-promo';
import { PasskeySetupPrompt } from '@/components/passkey-setup-prompt';
import { useTranslation } from '@/components/locale-provider';
import { getAuthFlowCopy } from '@/lib/i18n/auth-copy';

const SIGNUP_API_PATH = '/api/auth/signup';

const REFERRAL_OPTION_KEYS = [
  'googleSearch',
  'facebook',
  'instagram',
  'linkedIn',
  'youTube',
  'reddit',
  'friendOrColleague',
  'anotherCleaningCompany',
  'everittVentures',
  'other'
] as const;

function signupRedirect(plan: EverittosPlan, next: string): string {
  if (plan !== 'free') {
    return `/settings/billing?upgrade=${plan}`;
  }
  return safeNextPath(next, '/onboarding');
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'), '/onboarding');
  const selectedPlan = normalizePlan(searchParams.get('plan'));
  const referralCode = (searchParams.get('ref') || '').trim();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [referralSource, setReferralSource] = useState(referralCode ? 'referralCode' : '');
  const [referralDetail, setReferralDetail] = useState(referralCode);
  const urlError = useMemo(() => {
    const message = searchParams.get('error');
    if (!message) return '';
    const mapped = mapAuthError(searchParams.get('error_code') || decodeURIComponent(message));
    return mapped.message;
  }, [searchParams]);

  const [error, setError] = useState(urlError);
  const [errorCode, setErrorCode] = useState('');
  const [signInRecommended, setSignInRecommended] = useState(false);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState('');
  const { t, locale } = useTranslation();
  const copy = getAuthFlowCopy(locale).signup;
  const signupUrl = resolveClientApiUrl(SIGNUP_API_PATH);
  const referralOptions = REFERRAL_OPTION_KEYS.map((key) => ({
    key,
    label: copy.referralOptions[key]
  }));

  function referralSourceLabel(value: string): string {
    if (value === 'referralCode') return copy.referralCode;
    const match = referralOptions.find((option) => option.key === value);
    return match?.label || value;
  }

  const loginHref = `/login?next=${encodeURIComponent(next)}${selectedPlan !== 'free' ? `&plan=${selectedPlan}` : ''}`;

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode('');
    setSignInRecommended(false);
    setSuccess('');

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      setLoading(false);
      setError(copy.emailPasswordRequired);
      return;
    }

    if (password.length < 6) {
      setLoading(false);
      setError(copy.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setLoading(false);
      setError(copy.passwordsDoNotMatch);
      return;
    }

    if (!acceptLegal) {
      setLoading(false);
      setError(t('auth.consentRequired'));
      return;
    }

    try {
      const rateRes = await fetch('/api/auth/signup-rate-limit', { method: 'POST' });
      if (rateRes.status === 429) {
        setLoading(false);
        setError(copy.tooManyAttempts);
        return;
      }
    } catch {
      /* continue */
    }

    const redirectTarget = signupRedirect(selectedPlan, next);

    try {
      const { response, url, method } = await authApiFetch(SIGNUP_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          businessName: businessName.trim(),
          selectedPlan,
          referralSource: referralSourceLabel(referralSource.trim()),
          referralDetail: referralDetail.trim(),
          referralCode,
          next: redirectTarget.startsWith('http') ? next : redirectTarget
        })
      });

      const parsed = await parseLoginApiResponse(response, SIGNUP_API_PATH, url, method);

      if (!parsed.ok) {
        setLoading(false);
        setError(parsed.error.message || 'Signup failed.');
        setErrorCode((parsed.json.code as string) || '');
        setSignInRecommended(Boolean(parsed.json.signInRecommended));
        return;
      }

      const json = parsed.json;

      if (!json.confirmationRequired) {
        await fetch('/api/auth/setup', { method: 'POST' });
        await fetch('/api/account/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acceptTerms: true, acceptPrivacy: true })
        });
        setLoading(false);
        if (redirectTarget.startsWith('http')) {
          window.location.href = redirectTarget;
          return;
        }
        setPendingRedirect(redirectTarget);
        setShowPasskeyPrompt(true);
        return;
      }

      setLoading(false);
      setSuccess(
        (json.message as string) ||
          'Account created. Check your email and click the confirmation link, then sign in with your email and password.'
      );
    } catch (err) {
      const failure = parseFetchFailure(err, SIGNUP_API_PATH, signupUrl, 'POST');
      setLoading(false);
      const mapped = mapAuthError(failure.message);
      setError(mapped.message || failure.message);
    }
  }

  return (
    <AuthShell title={copy.title} hideContinuingLegalNote>
      {selectedPlan !== 'free' ? (
        <>
          <p className="auth-plan-note">
            {copy.planSelectedNote.replace('{plan}', planDisplayName(selectedPlan))}
          </p>
          <NoRefundDisclosure variant="card" className="auth-plan-refund-note" />
        </>
      ) : null}

      <p className="auth-methods-note">{t('auth.signUpMethods')}</p>

      <form className="auth-form card" onSubmit={createAccount}>
        <div className="auth-field">
          <label htmlFor="business_name">
            {copy.businessName} ({copy.optional})
          </label>
          <input
            id="business_name"
            className="input"
            placeholder={copy.businessNamePlaceholder}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="signup_referral_source">
            {copy.howDidYouHear} ({copy.optional})
          </label>
          <select
            id="signup_referral_source"
            className="input"
            value={referralSource}
            onChange={(e) => setReferralSource(e.target.value)}
          >
            <option value="" disabled>
              {copy.selectOne}
            </option>
            {referralCode ? <option value="referralCode">{copy.referralCode}</option> : null}
            {referralOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="auth-field">
          <label htmlFor="signup_referral_detail">
            {copy.referralDetails} ({copy.optional})
          </label>
          <input
            id="signup_referral_detail"
            className="input"
            value={referralDetail}
            onChange={(e) => setReferralDetail(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="email">{copy.email}</label>
          <input id="email" className="input" placeholder={copy.emailPlaceholder} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="auth-field">
          <label htmlFor="password">{copy.password}</label>
          <input id="password" className="input" placeholder={copy.passwordPlaceholder} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <div className="auth-field">
          <label htmlFor="confirm_password">{copy.confirmPassword}</label>
          <input id="confirm_password" className="input" placeholder={copy.passwordPlaceholder} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>

        <label className="auth-consent" htmlFor="signup_accept_legal">
          <input id="signup_accept_legal" type="checkbox" checked={acceptLegal} onChange={(e) => setAcceptLegal(e.target.checked)} required aria-describedby="signup-legal-consent-text" />
          <LegalConsentLabel idPrefix="signup-legal-consent" id="signup-legal-consent-text" />
        </label>

        <AuthMessages error={error} success={success} />

        {signInRecommended ? <p className="auth-recovery-note"><Link href={loginHref}>{copy.signIn}</Link></p> : null}
        {errorCode === 'existing_unconfirmed' ? (
          <p className="auth-recovery-note muted">{copy.existingUnconfirmed}</p>
        ) : null}

        <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? copy.creating : copy.createAccount}</button>
      </form>

      {showPasskeyPrompt && pendingRedirect ? (
        <>
          <OnboardingSupportPromo variant="welcome" />
          <PasskeySetupPrompt onDone={() => { router.push(pendingRedirect); router.refresh(); }} />
        </>
      ) : null}

      <div className="auth-links"><Link href={loginHref}>{copy.alreadyHaveAccount} {copy.signIn}</Link></div>
    </AuthShell>
  );
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>;
}
