'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthAsidePanel, AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { authApiFetch } from '@/lib/auth-fetch';
import { mapAuthError } from '@/lib/auth-errors';
import { parseFetchFailure, parseLoginApiResponse } from '@/lib/auth-request-error';
import { resolveClientApiUrl } from '@/lib/client-api-url';
import { isBrowserSupabaseMisconfigured } from '@/lib/supabase-config';

const RESET_API_PATH = '/api/auth/reset-password';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<{ title?: string; message: string; details?: string } | null>(null);
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

      setSuccess(
        (parsed.json.message as string) ||
          'If an account exists for that email, a reset link is on its way. Open the link to choose a new password.'
      );
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
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter the email on your account. We will send a secure reset link."
      aside={<AuthAsidePanel />}
    >
      <form className="auth-form card" onSubmit={resetPassword}>
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

        <AuthMessages
          error={error?.message}
          errorTitle={error?.title}
          errorDetails={error?.details}
          success={success}
        />

        <button className="btn btn-primary" type="submit" disabled={loading || configError}>
          {loading ? 'Sending...' : 'Send reset email'}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/login">Back to sign in</Link>
      </div>
    </AuthShell>
  );
}
