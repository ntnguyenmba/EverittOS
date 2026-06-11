'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthMessages } from '@/components/auth/auth-messages';
import { mapAuthError } from '@/lib/auth-errors';
import { defaultPathForRole } from '@/lib/role-routes';
import { supabase } from '@/lib/supabase';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<{ title?: string; message: string; details?: string } | null>(null);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function establishSession() {
      setCheckingSession(true);
      setError(null);

      const code = searchParams.get('code');

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          const mapped = mapAuthError(exchangeError.message, 'reset_link_expired');
          setError({ title: mapped.title, message: mapped.message, details: exchangeError.message });
          setCheckingSession(false);
          return;
        }
        setSessionReady(true);
        setCheckingSession(false);
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session) {
        setSessionReady(true);
        setCheckingSession(false);
        return;
      }

      const mapped = mapAuthError('reset_link_expired', 'reset_link_expired');
      setError({
        title: mapped.title,
        message: 'Open the password reset link from your email, or request a new link below.',
        details: mapped.details
      });
      setCheckingSession(false);
    }

    establishSession();
  }, [searchParams]);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();

    if (!sessionReady || loading) {
      if (!sessionReady) {
        const mapped = mapAuthError('reset_link_expired', 'reset_link_expired');
        setError({ title: mapped.title, message: mapped.message, details: mapped.details });
      }
      return;
    }

    if (password.length < 6) {
      setError({ title: 'Password too short', message: 'Password must be at least 6 characters.' });
      return;
    }

    if (password !== confirmPassword) {
      setError({ title: 'Passwords do not match', message: 'Enter the same password in both fields.' });
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess('');

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      const mapped = mapAuthError(updateError.message);
      setError({ title: mapped.title, message: mapped.message, details: updateError.message });
      return;
    }

    setSuccess('Password updated. Redirecting...');

    const {
      data: { user }
    } = await supabase.auth.getUser();
    let destination = '/dashboard';
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      destination = defaultPathForRole(profile?.role);
    }

    setTimeout(() => {
      window.location.href = destination;
    }, 900);
  }

  return (
    <AuthShell title="Choose a new password">
      {checkingSession ? <p className="muted">Verifying reset link...</p> : null}

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

        <AuthMessages
          error={error?.message}
          errorTitle={error?.title}
          errorDetails={error?.details}
          success={success}
        />

        <button className="btn btn-primary" type="submit" disabled={!sessionReady || loading}>
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>

      <div className="auth-links">
        <Link href="/forgot-password">Request new reset link</Link>
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
