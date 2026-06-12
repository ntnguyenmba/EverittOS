'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { authApiFetch } from '@/lib/auth-fetch';
import { safeNextPath } from '@/lib/app-url';
import { StripePromoCodeField } from '@/components/stripe-promo-code-field';
import { EVERITTOS_PLANS, normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { mapAuthError } from '@/lib/auth-errors';
import { normalizeEmail } from '@/lib/input-validation';
import { parseFetchFailure, parseLoginApiResponse } from '@/lib/auth-request-error';
import { resolveClientApiUrl } from '@/lib/client-api-url';
import { useTranslation } from '@/components/locale-provider';

const SIGNUP_API_PATH = '/api/auth/signup';

function signupRedirect(plan: EverittosPlan, next: string, promoCode = ''): string {
  if (plan !== 'free') {
    const params = new URLSearchParams({ upgrade: plan });
    if (promoCode.trim()) params.set('promo', promoCode.trim().toUpperCase());
    return `/settings/billing?${params.toString()}`;
  }
  return safeNextPath(next, '/onboarding');
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'), '/onboarding');
  const selectedPlan = normalizePlan(searchParams.get('plan'));
  const initialPromo = (searchParams.get('promo') || '').trim();
  const [promoCode, setPromoCode] = useState(initialPromo);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const urlError = useMemo(() => {
    const message = searchParams.get('error');
    if (!message) return '';
    const mapped = mapAuthError(searchParams.get('error_code') || decodeURIComponent(message));
    return decodeURIComponent(message) || mapped.message;
  }, [searchParams]);

  const [error, setError] = useState(urlError);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const { t } = useTranslation();
  const signupUrl = resolveClientApiUrl(SIGNUP_API_PATH);

  const loginHref = `/login?next=${encodeURIComponent(next)}${selectedPlan !== 'free' ? `&plan=${selectedPlan}` : ''}`;

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      setLoading(false);
      setError('Email and password are required.');
      return;
    }

    if (password.length < 6) {
      setLoading(false);
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setLoading(false);
      setError('Passwords do not match.');
      return;
    }

    if (!acceptTerms || !acceptPrivacy) {
      setLoading(false);
      setError(t('auth.consentRequired'));
      return;
    }

    try {
      const rateRes = await fetch('/api/auth/signup-rate-limit', { method: 'POST' });
      if (rateRes.status === 429) {
        setLoading(false);
        setError('Too many signup attempts. Wait an hour and try again.');
        return;
      }
    } catch {
      /* continue; Supabase still enforces auth limits */
    }

    const redirectTarget = signupRedirect(selectedPlan, next, promoCode);

    try {
      const { response, url, method } = await authApiFetch(SIGNUP_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          businessName: businessName.trim(),
          selectedPlan,
          next: redirectTarget.startsWith('http') ? next : redirectTarget
        })
      });

      const parsed = await parseLoginApiResponse(response, SIGNUP_API_PATH, url, method);

      if (!parsed.ok) {
        setLoading(false);
        setError(parsed.error.message || 'Signup failed.');
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
        if (redirectTarget.startsWith('http')) {
          window.location.href = redirectTarget;
          return;
        }
        router.push(redirectTarget);
        router.refresh();
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
    <AuthShell title="Create account">
      {selectedPlan !== 'free' ? (
        <p className="auth-plan-note">
          You selected <strong>{planDisplayName(selectedPlan)}</strong>. After signup you can finish checkout for that plan.
        </p>
      ) : null}

      <p className="auth-methods-note">{t('auth.signUpMethods')}</p>

      <form className="auth-form card" onSubmit={createAccount}>
        <div className="auth-field">
          <label htmlFor="business_name">Business or display name (optional)</label>
          <input
            id="business_name"
            className="input"
            placeholder="Leave blank for a personal workspace"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            placeholder="you@company.com"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            placeholder="Minimum 6 characters"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {selectedPlan !== 'free' ? (
          <StripePromoCodeField
            plan={selectedPlan}
            initialCode={initialPromo}
            onValidated={(preview) => {
              if (preview) setPromoCode(preview.code);
            }}
          />
        ) : null}

        <div className="auth-field">
          <label htmlFor="confirm_password">Confirm password</label>
          <input
            id="confirm_password"
            className="input"
            placeholder="Repeat password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <label className="auth-consent">
          <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required />
          <span>
            {t('auth.acceptTerms')} (<Link href="/terms">{t('legal.terms')}</Link>)
          </span>
        </label>
        <label className="auth-consent">
          <input type="checkbox" checked={acceptPrivacy} onChange={(e) => setAcceptPrivacy(e.target.checked)} required />
          <span>
            {t('auth.acceptPrivacy')} (<Link href="/privacy">{t('legal.privacy')}</Link>)
          </span>
        </label>

        <AuthMessages error={error} success={success} />

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Creating account...' : selectedPlan === 'free' ? 'Start free trial' : 'Create account'}
        </button>
      </form>

      <div className="auth-links">
        <Link href={loginHref}>Already have an account? Sign in</Link>
      </div>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
