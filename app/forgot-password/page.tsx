'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function resetPassword() {
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000/reset-password'
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Password reset email sent.');
  }

  return (
    <main className="section">
      <div className="container">
        <div className="card form">
          <h2>Forgot password</h2>

          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            className="btn btn-primary"
            onClick={resetPassword}
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send reset email'}
          </button>

          {message && <p>{message}</p>}
        </div>
      </div>
    </main>
  );
}
