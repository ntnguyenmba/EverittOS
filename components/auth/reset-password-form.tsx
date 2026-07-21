'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { PasswordField } from '@/components/auth/password-field';
import { useTranslation } from '@/components/locale-provider';
import { authApiFetch } from '@/lib/auth-fetch';
import { mapAuthError } from '@/lib/auth-errors';
import { parseFetchFailure, parseLoginApiResponse } from '@/lib/auth-request-error';
import { resolveClientApiUrl } from '@/lib/client-api-url';
import { getAuthFlowCopy } from '@/lib/i18n/auth-copy';

const UPDATE_PASSWORD_API_PATH = '/api/auth/update-password';

type ResetPasswordFormProps = {
  sessionReady: boolean;
  initialError?: { title?: string; message: string; details?: string } | null;
};

export function ResetPasswordForm({ sessionReady, initialError = null }: ResetPasswordFormProps) {
  const { locale } = useTranslation();
  const copy = getAuthFlowCopy(locale).reset;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const updatePasswordUrl = resolveClientApiUrl(UPDATE_PASSWORD_API_PATH);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();

    if (!sessionReady || loading) {
      if (!sessionReady) {
        const mapped = mapAuthError('reset_link_expired', 'reset_link_expired');
        setError({ title: mapped.title, message: mapped.message });
      }
      return;
    }

    if (password.length < 6) {
      setError({ title: copy.passwordTooShortTitle, message: copy.passwordTooShort });
      return;
    }

    if (password !== confirmPassword) {
      setError({ title: copy.passwordsMismatchTitle, message: copy.passwordsMismatch });
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess('');

    try {
      const { response, url, method } = await authApiFetch(UPDATE_PASSWORD_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const parsed = await parseLoginApiResponse(response, UPDATE_PASSWORD_API_PATH, url, method);
      setLoading(false);

      if (!parsed.ok) {
        setError({
          title: parsed.error.title,
          message: parsed.error.message
        });
        return;
      }

      const json = parsed.json;
      setSuccess((json.message as string) || copy.successFallback);
      const destination = (json.redirectTo as string) || '/login?reset=1';
      setTimeout(() => {
        window.location.href = destination;
      }, 900);
    } catch (err) {
      const failure = parseFetchFailure(err, UPDATE_PASSWORD_API_PATH, updatePasswordUrl, 'POST');
      setLoading(false);
      setError({
        title: failure.title,
        message: failure.message
      });
    }
  }

  return (
    <AuthShell title={copy.title}>
      <form className="auth-form card" onSubmit={updatePassword}>
        <PasswordField
          id="password"
          label={copy.newPassword}
          placeholder={copy.newPasswordPlaceholder}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          disabled={!sessionReady || loading}
          required
        />

        <PasswordField
          id="confirm_password"
          label={copy.confirmPassword}
          placeholder={copy.confirmPasswordPlaceholder}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          disabled={!sessionReady || loading}
          required
        />

        <AuthMessages
          error={error?.message}
          errorTitle={error?.title}
          success={success}
        />

        <button className="btn btn-primary" type="submit" disabled={!sessionReady || loading || !password || !confirmPassword}>
          {loading ? copy.updating : copy.updatePassword}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/forgot-password">{copy.requestNewLink}</Link>
        <Link href="/login">{copy.backToSignIn}</Link>
      </div>
    </AuthShell>
  );
}
