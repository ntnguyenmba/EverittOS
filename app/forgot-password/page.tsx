'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { useTranslation } from '@/components/locale-provider';
import { authApiFetch } from '@/lib/auth-fetch';
import { mapAuthError } from '@/lib/auth-errors';
import { parseFetchFailure, parseLoginApiResponse } from '@/lib/auth-request-error';
import { resolveClientApiUrl } from '@/lib/client-api-url';
import { getAuthFlowCopy } from '@/lib/i18n/auth-copy';
import { isBrowserSupabaseMisconfigured } from '@/lib/supabase-config';

const RESET_API_PATH = '/api/auth/reset-password';

function ForgotPasswordForm() {
  const { locale } = useTranslation();
  const copy = getAuthFlowCopy(locale).forgot;
  const searchParams = useSearchParams();
  const urlError = useMemo(() => {
    const message = searchParams.get('error');
    const code = searchParams.get('error_code');
    if (!message) return null;
    const mapped = mapAuthError(code || decodeURIComponent(message));
    return {
      title: mapped.title,
      message: mapped.message,
      details: code ? `Supabase: ${code}` : mapped.details
    };
  }, [searchParams]);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<{ title?: string; message: string; details?: string } | null>(urlError);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const configError = isBrowserSupabaseMisconfigured();
  const resetUrl = resolveClientApiUrl(RESET_API_PATH);

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess('');

    if (configError) {
      const mapped = mapAuthError('config_error', 'config_error');
      setError({
        title: mapped.title,
        message: mapped.message,
        details: `Requested URL: ${resetUrl}\n${mapped.details || ''}`
      });
      setLoading(false);
      return;
    }

    try {
      const { response, url, method } = await authApiFetch(RESET_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const parsed = await parseLoginApiResponse(response, RESET_API_PATH, url, method);

      if (!parsed.ok) {
        setError({
          title: parsed.error.title,
          message: parsed.error.message,
          details: parsed.error.details
        });
        setLoading(false);
        return;
      }

      setSuccess((parsed.json.message as string) || copy.successFallback);
      setLoading(false);
    } catch (err) {
      const failure = parseFetchFailure(err, RESET_API_PATH, resetUrl, 'POST');
      setError({
        title: failure.title,
        message: failure.message,
        details: failure.details
      });
      setLoading(false);
    }
  }

  return (
    <AuthShell title={copy.title}>
      <form className="auth-form card" onSubmit={resetPassword}>
        <div className="auth-field">
          <label htmlFor="email">{copy.email}</label>
          <input
            id="email"
            className="input"
            placeholder={copy.emailPlaceholder}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <AuthMessages
          error={error?.message}
          errorTitle={error?.title}
          errorDetails={error?.details}
          success={success}
        />

        <button className="btn btn-primary" type="submit" disabled={loading || configError}>
          {loading ? copy.sending : copy.sendReset}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/login">{copy.backToSignIn}</Link>
      </div>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
