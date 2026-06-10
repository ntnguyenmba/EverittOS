'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { supabase } from '@/lib/supabase';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    async function establishSession() {
      const code = searchParams.get('code');

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          const codeValue = 'code' in exchangeError ? String((exchangeError as { code?: string }).code) : '';
          const expired =
            exchangeError.message.toLowerCase().includes('expired') ||
            exchangeError.message.toLowerCase().includes('invalid') ||
            codeValue === 'otp_expired';
          setError(
            expired
              ? 'This reset link has expired. Request a new link from the forgot password page.'
              : exchangeError.message
          );
          return;
        }
        setSessionReady(true);
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session) {
        setSessionReady(true);
        return;
      }

      setError('Open the password reset link from your email to continue.');
    }

    establishSession();
  }, [searchParams]);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();

    if (!sessionReady || loading) {
      if (!sessionReady) setError('Use the link from your reset email first.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess('Password updated. Redirecting to your dashboard...');
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 900);
  }

  return (
    <AuthShell
      eyebrow="New password"
      title="Choose a new password"
      description="Enter and confirm a new password for your EverittOS account."
    >
      <form className="auth-form card" onSubmit={updatePassword}>
        <div className="auth-field">
          <label htmlFor="password">New password</label>
          <input
            id="password"
            className="input"
            placeholder="Minimum 6 characters"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!sessionReady || loading}
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
            disabled={!sessionReady || loading}
            required
          />
        </div>

        <AuthMessages error={error} success={success} />

        <button className="btn btn-primary" type="submit" disabled={!sessionReady || loading}>
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/login">Back to sign in</Link>
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
