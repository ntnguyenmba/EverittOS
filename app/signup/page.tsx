'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { appUrl, safeNextPath } from '@/lib/app-url';
import { EVERITTOS_PLANS, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { mapAuthError } from '@/lib/auth-errors';
import { useTranslatedPlanName } from '@/lib/i18n-client';
import { friendlyErrorMessage } from '@/lib/user-errors';
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
  const t = useTranslations('auth');
  const commonT = useTranslations('common');
  const planName = useTranslatedPlanName();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const loginHref = `/login?next=${encodeURIComponent(next)}${selectedPlan !== 'free' ? `&plan=${selectedPlan}` : ''}`;

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!email.trim() || !password) {
      setLoading(false);
      setError(t('emailPasswordRequired'));
      return;
    }

    if (password.length < 6) {
      setLoading(false);
      setError(t('passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setLoading(false);
      setError(t('passwordsNoMatch'));
      return;
    }

    try {
      const rateRes = await fetch('/api/auth/signup-rate-limit', { method: 'POST' });
      if (rateRes.status === 429) {
        setLoading(false);
        setError(t('tooManySignups'));
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
          account_status: 'active',
          locale: document.documentElement.lang || 'en'
        },
        { onConflict: 'id' }
      );
    }

    setLoading(false);

    if (data.session) {
      if (redirectTarget.startsWith('http')) {
        window.location.href = redirectTarget;
        return;
      }
      router.push(redirectTarget);
      router.refresh();
      return;
    }

    setSuccess(t('accountCreatedVerify'));
  }

  return (
    <AuthShell title={t('createAccount')}>
      {selectedPlan !== 'free' ? (
        <p className="auth-plan-note">
          {t('selectedPlanSignup', { plan: planName(selectedPlan) })}
        </p>
      ) : null}

      <form className="auth-form card" onSubmit={createAccount}>
        <div className="auth-field">
          <label htmlFor="business_name">{t('businessNameOptional')}</label>
          <input
            id="business_name"
            className="input"
            placeholder={t('businessNamePlaceholder')}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="email">{commonT('email')}</label>
          <input
            id="email"
            className="input"
            placeholder={t('emailPlaceholder')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">{commonT('password')}</label>
          <input
            id="password"
            className="input"
            placeholder={t('passwordMinPlaceholder')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="confirm_password">{t('confirmPassword')}</label>
          <input
            id="confirm_password"
            className="input"
            placeholder={t('repeatPassword')}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <AuthMessages error={error} success={success} />

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? t('creatingAccount') : selectedPlan === 'free' ? t('startFreeTrial') : t('createAccount')}
        </button>
      </form>

      <div className="auth-links">
        <Link href={loginHref}>{t('alreadyHaveAccount')}</Link>
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
