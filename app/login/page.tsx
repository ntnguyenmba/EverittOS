'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { authApiFetch, LOGIN_API_PATH } from '@/lib/auth-fetch';
import { mapAuthError } from '@/lib/auth-errors';
import { useAuthErrors, useTranslatedPlanName } from '@/lib/i18n-client';
import { logAuthEvent } from '@/lib/auth-logger';
import { parseFetchFailure, parseLoginApiResponse, type LoginClientError } from '@/lib/auth-request-error';
import { resolveClientApiUrl } from '@/lib/client-api-url';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { safeNextPath } from '@/lib/app-url';
import { storeTabSessionId } from '@/lib/session-client';
import { isBrowserSupabaseMisconfigured } from '@/lib/supabase-config';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const selectedPlan = normalizePlan(searchParams.get('plan'));
  const loginUrl = resolveClientApiUrl(LOGIN_API_PATH);
  const t = useTranslations('auth');
  const commonT = useTranslations('common');
  const { mapAccessError, mapAuthError: mapAuthErrorI18n } = useAuthErrors();
  const planName = useTranslatedPlanName();

  const accessBlock = useMemo(() => {
    const reason = searchParams.get('reason');
    const detail = searchParams.get('detail');
    if (!reason) return null;
    const mapped = mapAccessError(reason);
    return { ...mapped, details: detail || mapped.details };
  }, [searchParams, mapAccessError]);

  const authErrorParam = searchParams.get('error');
  const authErrorMapped = useMemo(() => {
    if (!authErrorParam) return null;
    return mapAuthErrorI18n(decodeURIComponent(authErrorParam));
  }, [authErrorParam, mapAuthErrorI18n]);

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
      endpoint: nextError.debug.requestedUrl,
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
        title: t('configRequiredTitle'),
        message: t('configRequiredBody'),
        details: `Requested URL: ${loginUrl}\nMethod: POST\nAPI code: config_error\n${mapped.details || ''}`,
        debug: {
          endpoint: LOGIN_API_PATH,
          requestedUrl: loginUrl,
          method: 'POST',
          apiCode: 'config_error',
          rawError: mapped.details
        }
      });
      setLoading(false);
      return;
    }

    try {
      const { response, url, method } = await authApiFetch(LOGIN_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next })
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

  return (
    <AuthShell title={t('signIn')}>
      {configError ? (
        <AuthMessages
          errorTitle={t('configRequiredTitle')}
          error={t('configRequiredBody')}
          errorDetails={`Requested URL: ${loginUrl}\nMissing: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY`}
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
          {t('selectedPlanSignIn', { plan: planName(selectedPlan as EverittosPlan) })}
        </p>
      ) : null}

      <form className="auth-form card" onSubmit={handleLogin}>
        <div className="auth-field">
          <label htmlFor="email">{commonT('email')}</label>
          <input
            id="email"
            className="input"
            placeholder={t('emailPlaceholder')}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">{commonT('password')}</label>
          <input
            id="password"
            className="input"
            placeholder={t('passwordPlaceholder')}
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
          success={verified ? t('emailVerified') : undefined}
        />

        <button className="btn btn-primary" type="submit" disabled={loading || configError}>
          {loading ? t('signingIn') : t('signInAction')}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/forgot-password">{t('forgotPassword')}</Link>
        <Link href={signupHref}>{t('createAccount')}</Link>
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
