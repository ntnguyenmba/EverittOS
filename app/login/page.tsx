'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="section">
      <div className="container grid-2">
        <div>
          <h2>Login</h2>

          <p>
            Log in to manage EverittOS jobs, workers, and operations.
          </p>
        </div>

        <div className="card form">
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

          <button
            className="btn btn-primary"
            onClick={login}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Log in'}
          </button>

          <Link className="btn" href="/signup">
            Create account
          </Link>

          <Link className="btn" href="/forgot-password">
            Forgot password?
          </Link>

          {message && <p>{message}</p>}
        </div>
      </div>
    </main>
  );
}
