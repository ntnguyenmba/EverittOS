'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    async function establishSession() {
      const code = searchParams.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
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

      setMessage('Open the password reset link from your email to continue.');
    }

    establishSession();
  }, [searchParams]);

  async function updatePassword() {
    if (!sessionReady || loading) {
      if (!sessionReady) setMessage('Use the link from your reset email first.');
      return;
    }

    if (!password.trim()) {
      setMessage('Enter a new password.');
      return;
    }

    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Password updated. Redirecting to sign in...');
    router.push('/login');
    router.refresh();
  }

  return (
    <main className="section">
      <div className="container">
        <div className="card form">
          <h2>Reset password</h2>
          <input
            className="input"
            placeholder="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!sessionReady || loading}
          />
          <button className="btn btn-primary" type="button" onClick={updatePassword} disabled={!sessionReady || loading}>
            {loading ? 'Updating...' : 'Update password'}
          </button>
          <Link className="btn" href="/login">
            Back to login
          </Link>
          {message && <p>{message}</p>}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
