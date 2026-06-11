'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { appUrl, safeNextPath } from '@/lib/app-url';
import { EVERITTOS_PLANS, normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { mapAuthError } from '@/lib/auth-errors';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { useTranslation } from '@/components/locale-provider';
import { supabase } from '@/lib/supabase';

function signupRedirect(plan: EverittosPlan, next: string): string {
  if (plan !== 'free') {
    const tier = EVERITTOS_PLANS.find((item) => item.id === plan);
    if (tier?.stripeLink) return tier.stripeLink;
    return `/billing?plan=${plan}`;
  }
  return safeNextPath(next, '/onboarding');
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'), '/onboarding');
  const selectedPlan = normalizePlan(searchParams.get('plan'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const { t } = useTranslation();

  const loginHref = `/login?next=${encodeURIComponent(next)}${selectedPlan !== 'free' ? `&plan=${selectedPlan}` : ''}`;

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!email.trim() || !password) {
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

    const redirectTarget = signupRedirect(selectedPlan, next);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(redirectTarget.startsWith('http') ? next : redirectTarget)}`),
        data: {
          business_name: businessName.trim(),
          selected_plan: selectedPlan
        }
      }
    });

    if (signUpError) {
      setLoading(false);
      const mapped = mapAuthError(signUpError.message);
      setError(mapped.message || friendlyErrorMessage(signUpError.message));
      return;
    }

    if (data.user) {
      await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          email,
          business_name: businessName.trim(),
          role: 'owner',
          plan: selectedPlan === 'free' ? 'free' : selectedPlan,
          subscription_status: selectedPlan === 'free' ? 'free' : 'incomplete',
          account_status: 'active'
        },
        { onConflict: 'id' }
      );
    }

    setLoading(false);

    if (data.session) {
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

    setSuccess('Account created. Check your email to verify your address, then sign in.');
  }

  return (
    <AuthShell title="Create account">
      {selectedPlan !== 'free' ? (
        <p className="auth-plan-note">
          You selected <strong>{planDisplayName(selectedPlan)}</strong>. After signup you can finish checkout for that plan.
        </p>
      ) : null}

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
