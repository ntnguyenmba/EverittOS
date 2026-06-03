'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setMessage('Missing invitation token.');
  }, [token]);

  async function accept() {
    if (!token) return;
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/team/accept?token=${token}`)}`);
      return;
    }

    const res = await fetch('/api/team/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.error || 'Could not accept invitation');
      return;
    }
    router.push('/dashboard');
  }

  return (
    <main className="section">
      <div className="container">
        <div className="card form">
          <h2>Accept team invitation</h2>
          <p>Sign in with the email that received the invite, then accept to join the organization.</p>
          <button type="button" className="btn btn-primary" disabled={loading || !token} onClick={accept}>
            {loading ? 'Accepting...' : 'Accept invitation'}
          </button>
          {message && <p>{message}</p>}
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main className="section"><div className="container card">Loading...</div></main>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
