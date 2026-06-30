'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { supabase } from '@/lib/supabase';

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [message, setMessage] = useState('Checking invitation...');
  const [loading, setLoading] = useState(false);
  const signInHref = token ? `/login?next=${encodeURIComponent(`/team/accept?token=${token}`)}` : '/login';

  const accept = useCallback(async () => {
    setLoading(true);
    setMessage('Checking invitation...');

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setMessage('Please sign in with the email that received the invitation.');
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
      setMessage(json.error || 'Could not accept invitation.');
      return;
    }

    setMessage('Invitation accepted. Redirecting...');
    router.push('/dashboard');
  }, [router, token]);

  useEffect(() => {
    void accept();
  }, [accept]);

  return (
    <AuthenticatedSection>
      <div className="card form">
        <h2>Accept team invitation</h2>
        <p>Sign in with the email that received the invite, then accept to join the organization.</p>
        <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void accept()}>
          {loading ? 'Checking...' : 'Accept invitation'}
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
