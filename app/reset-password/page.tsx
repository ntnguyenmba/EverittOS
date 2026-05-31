'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function updatePassword() {
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
          />
          <button className="btn btn-primary" type="button" onClick={updatePassword} disabled={loading}>
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
