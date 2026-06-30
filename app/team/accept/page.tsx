'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { supabase } from '@/lib/supabase';

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const signInHref = token ? `/login?next=${encodeURIComponent(`/team/accept?token=${token}`)}` : '/login';

  useEffect(() => {
    if (!token) setMessage('Missing invitation token. Go back to the pending invitation and copy the full accept link again.');
  }, [token]);

  async function accept() {
    if (!token) return;
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(signInHref);
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
    <AuthenticatedSection>
        <div className="card form">
          <h2>Accept team invitation</h2>
          <p>Sign in with the email that received the invite, then accept to join the organization.</p>
          <button type="button" className="btn btn-primary" disabled={loading || !token} onClick={accept}>
            {loading ? 'Accepting...' : 'Accept invitation'}
          </button>
          {message && <p>{message}</p>}
          <Link href={signInHref}>Sign in</Link>
        </div>
    </AuthenticatedSection>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AuthenticatedSection><div className="card">Loading...</div></AuthenticatedSection>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
