'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function createAccount() {
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName
        }
      }
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Account created. Check your email to confirm your account.');
  }

  return (
    <main className="section">
      <div className="container grid-2">
        <div>
          <h2>Create your EverittOS account</h2>
          <p>Start managing jobs, workers, and proof reports from one clean dashboard.</p>
        </div>

        <div className="card form">
          <input
            className="input"
            placeholder="Business name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />

          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="btn btn-primary" onClick={createAccount} disabled={loading}>
            {loading ? 'Creating...' : 'Create account'}
          </button>

          <Link className="btn" href="/login">
            Already have an account? Log in
          </Link>

          {message && <p>{message}</p>}
        </div>
      </div>
    </main>
  );
}