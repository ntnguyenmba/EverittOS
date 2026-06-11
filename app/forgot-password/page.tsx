'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { mapAuthError } from '@/lib/auth-errors';
import { appUrl } from '@/lib/app-url';
import { isBrowserSupabaseMisconfigured } from '@/lib/supabase-config';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<{ title?: string; message: string; details?: string } | null>(null);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const configError = isBrowserSupabaseMisconfigured();

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess('');

    if (configError) {
      const mapped = mapAuthError('config_error', 'config_error');
      setError({ title: mapped.title, message: mapped.message, details: mapped.details });
      setLoading(false);
      return;
    }

    const redirectTo = appUrl('/auth/callback?next=/reset-password&type=recovery');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo
    });

    setLoading(false);

    if (resetError) {
      const mapped = mapAuthError(resetError.message);
      setError({ title: mapped.title, message: mapped.message, details: resetError.message });
      return;
    }

    setSuccess('If an account exists for that email, a reset link is on its way. Open the link to choose a new password.');
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter the email on your account. We will send a secure reset link."
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
