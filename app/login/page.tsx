'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!email.trim() || !password.trim()) {
      setMessage('Enter your email and password.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="section">
      <div className="container grid-2">
        <div>
          <h2>Welcome back</h2>
          <p>Log in to manage EverittOS jobs, workers, and operations.</p>
        </div>

        <form className="card form" onSubmit={handleLogin}>
          <input
            className="input"
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="input"
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Continue'}
          </button>

          <Link className="btn" href="/signup">
            Create account
          </Link>

          <Link className="btn" href="/forgot-password">
            Forgot password?
          </Link>

          {message && <p>{message}</p>}
        </form>
      </div>
    </main>
  );
}
