'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { appUrl } from '@/lib/app-url';

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  return next;
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function createAccount() {
    setLoading(true);
    setMessage('');

    if (!businessName || !email || !password) {
      setLoading(false);
      setMessage('Please fill in all fields.');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: appUrl('/auth/callback?next=' + encodeURIComponent(next)),
        data: { business_name: businessName }
      }
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          email,
          business_name: businessName,
          role: 'owner',
          plan: 'free',
          subscription_status: 'free'
        },
        { onConflict: 'id' }
      );
    }

    if (data.session) {
      router.push('/onboarding');
      router.refresh();
      return;
    }

    setMessage('Account created. Check your email to verify your address, then sign in.');
  }

  return (
    <main className="section">
      <div className="container grid-2">
        <div>
          <h2>Create your EverittOS account</h2>
          <p>Start free. Keep jobs, crews, photos, and reports in one place.</p>
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

          <button className="btn btn-primary" type="button" onClick={createAccount} disabled={loading}>
            {loading ? 'Creating...' : 'Start Free'}
          </button>

          <Link className="btn" href={`/login?next=${encodeURIComponent(next)}`}>
            Already have an account? Log in
          </Link>

          {message && <p>{message}</p>}
        </div>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
