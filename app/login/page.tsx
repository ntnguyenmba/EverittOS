'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { AuthAsidePanel, AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { mapAccessError, mapAuthError } from '@/lib/auth-errors';
import { logAuthEvent } from '@/lib/auth-logger';
import { parseFetchFailure, parseLoginApiResponse, type LoginClientError } from '@/lib/auth-request-error';
import { planDisplayName, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { safeNextPath } from '@/lib/app-url';
import { isBrowserSupabaseMisconfigured } from '@/lib/supabase-config';

const LOGIN_ENDPOINT = '/api/auth/login';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const selectedPlan = normalizePlan(searchParams.get('plan'));

  const accessBlock = useMemo(() => {
    const reason = searchParams.get('reason');
    const detail = searchParams.get('detail');
    if (!reason) return null;
    const mapped = mapAccessError(reason);
    return { ...mapped, details: detail || mapped.details };
  }, [searchParams]);

  const authErrorParam = searchParams.get('error');
  const authErrorMapped = useMemo(() => {
    if (!authErrorParam) return null;
    return mapAuthError(decodeURIComponent(authErrorParam));
  }, [authErrorParam]);

  const verified = searchParams.get('verified');
  const configError = isBrowserSupabaseMisconfigured();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<LoginClientError | null>(null);
  const [loading, setLoading] = useState(false);

  const signupHref = `/signup?next=${encodeURIComponent(next)}${selectedPlan !== 'free' ? `&plan=${selectedPlan}` : ''}`;

  function showError(nextError: LoginClientError) {
    setError(nextError);
    logAuthEvent('login_client_error', {
      endpoint: nextError.debug.endpoint,
      status: nextError.debug.httpStatus || 0,
      code: nextError.debug.apiCode || 'client'
    });
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (configError) {
      const mapped = mapAuthError('config_error', 'config_error');
      showError({
        title: mapped.title,
        message: mapped.message,
        details: `Endpoint: POST ${LOGIN_ENDPOINT}\nAPI code: config_error\n${mapped.details || ''}`,
        debug: {
          endpoint: LOGIN_ENDPOINT,
          method: 'POST',
          apiCode: 'config_error',
          rawError: mapped.details
        }
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ email, password, next })
      });

      const parsed = await parseLoginApiResponse(res, LOGIN_ENDPOINT, 'POST');

      if (!parsed.ok) {
        showError(parsed.error);
        setLoading(false);
        return;
      }

      const json = parsed.json;
      const redirectTo = (json.redirectTo as string) || next;

      window.location.assign(redirectTo);
    } catch (err) {
      showError(parseFetchFailure(err, LOGIN_ENDPOINT, 'POST'));
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back to EverittOS"
      description="Sign in to manage jobs, crews, photos, and field reports."
      aside={<AuthAsidePanel />}
    >
      {configError ? (
        <AuthMessages
          errorTitle="Configuration required"
          error="Authentication is not configured for this deployment. Set Supabase environment variables in Vercel and redeploy."
          errorDetails={`Endpoint: POST ${LOGIN_ENDPOINT}\nMissing: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY`}
        />
      ) : null}

      {accessBlock ? (
        <AuthMessages
          errorTitle={accessBlock.title}
          error={accessBlock.message}
          errorDetails={accessBlock.details}
        />
      ) : null}

      {selectedPlan !== 'free' ? (
        <p className="auth-plan-note">
          Selected plan: <strong>{planDisplayName(selectedPlan as EverittosPlan)}</strong>. Sign in to continue setup.
        </p>
      ) : null}

      <form className="auth-form card" onSubmit={handleLogin}>
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            placeholder="you@company.com"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            placeholder="Your password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <AuthMessages
          error={error?.message || authErrorMapped?.message}
          errorTitle={error?.title || authErrorMapped?.title}
          errorDetails={error?.details || authErrorMapped?.details}
          success={verified ? 'Email verified. You can sign in now.' : undefined}
        />

        <button className="btn btn-primary" type="submit" disabled={loading || configError}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="auth-links">
        <Link href={signupHref}>Create account</Link>
        <Link href="/forgot-password">Forgot password</Link>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
