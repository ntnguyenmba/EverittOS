'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { PasswordField } from '@/components/auth/password-field';
import { authApiFetch, LOGIN_API_PATH } from '@/lib/auth-fetch';
import { logAuthDebug } from '@/lib/auth-debug';
import { mapAccessError, mapAuthError } from '@/lib/auth-errors';
import { parseFetchFailure, parseLoginApiResponse, type LoginClientError } from '@/lib/auth-request-error';
import { resolveClientApiUrl } from '@/lib/client-api-url';
import { planDisplayName, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { safeNextPath } from '@/lib/app-url';
import { storeTabSessionId } from '@/lib/session-client';
import { useTranslation } from '@/components/locale-provider';
import { normalizeEmail } from '@/lib/input-validation';
import { isBrowserSupabaseMisconfigured } from '@/lib/supabase-config';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const selectedPlan = normalizePlan(searchParams.get('plan'));
  const loginUrl = resolveClientApiUrl(LOGIN_API_PATH);

  const accessBlock = useMemo(() => {
    const reason = searchParams.get('reason');
    const detail = searchParams.get('detail');
    if (!reason) return null;
    const mapped = mapAccessError(reason);
    return { title: mapped.title, message: mapped.message };
  }, [searchParams]);

  const authErrorMapped = useMemo(() => {
    const message = searchParams.get('error');
    const code = searchParams.get('error_code');
    if (!message) return null;
    const mapped = mapAuthError(code || decodeURIComponent(message));
    return { title: mapped.title, message: mapped.message };
  }, [searchParams]);

  const verified = searchParams.get('verified');
  const passwordReset = searchParams.get('reset');
  const configError = isBrowserSupabaseMisconfigured();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<LoginClientError | null>(null);
  const [loading, setLoading] = useState(false);

  const signupHref = `/signup?next=${encodeURIComponent(next)}${selectedPlan !== 'free' ? `&plan=${selectedPlan}` : ''}`;
  const { t } = useTranslation();

  function showError(nextError: LoginClientError) {
    setError(nextError);
    logAuthDebug('login_client_error', {
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
        details: '',
        debug: {
          endpoint: LOGIN_API_PATH,
          requestedUrl: loginUrl,
          method: 'POST',
          apiCode: 'config_error'
        }
      });
      setLoading(false);
      return;
    }

    try {
      const { response, url, method } = await authApiFetch(LOGIN_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizeEmail(email), password, next })
      });

      const parsed = await parseLoginApiResponse(response, LOGIN_API_PATH, url, method);

      if (!parsed.ok) {
        showError(parsed.error);
        setLoading(false);
        return;
      }

      const json = parsed.json;
      const redirectTo = (json.redirectTo as string) || next;

      if (typeof json.tabSessionId === 'string' && json.tabSessionId) {
        storeTabSessionId(json.tabSessionId);
      }

      window.location.assign(redirectTo);
    } catch (err) {
      showError(parseFetchFailure(err, LOGIN_API_PATH, loginUrl, 'POST'));
      setLoading(false);
    }
  }

  const successMessage = passwordReset
    ? 'Password updated. Sign in with your new password.'
    : verified
      ? 'Email verified. You can sign in now.'
      : undefined;

  return (
    <AuthShell title="Sign in">
      {configError ? (
        <AuthMessages
          errorTitle="Configuration required"
          error="Authentication is not configured for this deployment. Set Supabase environment variables and redeploy."
        />
      ) : null}

      {accessBlock ? (
        <AuthMessages errorTitle={accessBlock.title} error={accessBlock.message} />
      ) : null}

      {selectedPlan !== 'free' ? (
        <p className="auth-plan-note">
          Selected plan: <strong>{planDisplayName(selectedPlan as EverittosPlan)}</strong>. Sign in to continue setup.
        </p>
      ) : null}

      <p className="auth-methods-note">{t('auth.signInMethods')}</p>

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
            disabled={loading}
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          placeholder="Your password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          disabled={loading}
          required
        />

        <AuthMessages
          error={error?.message || authErrorMapped?.message}
          errorTitle={error?.title || authErrorMapped?.title}
          success={successMessage}
        />

        <button className="btn btn-primary" type="submit" disabled={loading || configError || !email || !password}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/forgot-password">Forgot password</Link>
        <Link href={signupHref}>Create account</Link>
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
