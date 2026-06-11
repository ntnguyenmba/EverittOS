'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthAsidePanel, AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { appUrl, safeNextPath } from '@/lib/app-url';
import { EVERITTOS_PLANS, normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { mapAuthError } from '@/lib/auth-errors';
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

    if (!businessName.trim() || !email.trim() || !password) {
      setLoading(false);
      setError('Please fill in all fields.');
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
    <AuthShell
      eyebrow="Create account"
      title="Start your workspace"
      description="Set up your workspace for jobs, customers, crews, and reports."
      aside={<AuthAsidePanel />}
    >
      {selectedPlan !== 'free' ? (
        <p className="auth-plan-note">
          You selected <strong>{planDisplayName(selectedPlan)}</strong>. After signup you can finish checkout for that plan.
        </p>
      ) : null}

      <form className="auth-form card" onSubmit={createAccount}>
        <div className="auth-field">
          <label htmlFor="business_name">Business name</label>
          <input
            id="business_name"
            className="input"
            placeholder="Your company name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
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

        <AuthMessages error={error} success={success} />

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Creating account...' : selectedPlan === 'free' ? 'Start free' : 'Create account'}
        </button>
      </form>

      <div className="auth-links">
        <Link href={loginHref}>Already have an account? Sign in</Link>
        <Link href="/pricing">Compare plans</Link>
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
