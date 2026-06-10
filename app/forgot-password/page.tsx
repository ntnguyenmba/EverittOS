'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { appUrl } from '@/lib/app-url';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl('/auth/callback?next=/reset-password')
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess('Password reset email sent. Open the link in that message to choose a new password.');
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter the email on your account. We will send a secure link through Supabase."
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

        <AuthMessages error={error} success={success} />

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send reset email'}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/login">Back to sign in</Link>
      </div>
    </AuthShell>
  );
}
