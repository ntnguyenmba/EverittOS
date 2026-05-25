'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function updatePassword() {
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.updateUser({
      password
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Password updated successfully.');
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

          <button
            className="btn btn-primary"
            onClick={updatePassword}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>

          {message && <p>{message}</p>}
        </div>
      </div>
    </main>
  );
}
