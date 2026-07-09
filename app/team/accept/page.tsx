'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { supabase } from '@/lib/supabase';

type AcceptStatus = 'checking' | 'needs-sign-in' | 'accepted' | 'already-accepted' | 'error';

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [message, setMessage] = useState('Checking your invitation...');
  const [status, setStatus] = useState<AcceptStatus>('checking');
  const [loading, setLoading] = useState(false);
  const signInHref = token ? `/login?next=${encodeURIComponent(`/team/accept?token=${token}`)}` : '/login';

  const accept = useCallback(async () => {
    setLoading(true);
    setStatus('checking');
    setMessage('Checking your invitation...');

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setStatus('needs-sign-in');
      setMessage('Next step: sign in with the same email address that received the invite, then return here to join the workspace.');
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
      setStatus('error');
      setMessage(json.error || 'Could not accept invitation. Ask the workspace owner to resend the invite.');
      return;
    }

    const alreadyAccepted = typeof json.message === 'string' && json.message.toLowerCase().includes('already accepted');
    setStatus(alreadyAccepted ? 'already-accepted' : 'accepted');
    setMessage(
      alreadyAccepted
        ? 'You are already connected to this workspace. No further action is needed.'
        : 'Invitation accepted. You are now connected to the workspace. No further action is needed.'
    );
  }, [token]);

  useEffect(() => {
    void accept();
  }, [accept]);

  return (
    <AuthenticatedSection>
      <div className="card form">
        <p className="eyebrow">EverittOS team access</p>
        <h2>Accept team invitation</h2>
        <p>This page connects your signed-in account to the business workspace. Use the same email address that received the invitation.</p>
        <div className="auth-message" role="status">
          <strong>{status === 'accepted' || status === 'already-accepted' ? 'All set' : status === 'needs-sign-in' ? 'Sign in required' : status === 'error' ? 'Action needed' : 'Checking'}</strong>
          <p>{message}</p>
        </div>
        <div className="inline-actions">
          {status === 'accepted' || status === 'already-accepted' ? (
            <button type="button" className="btn btn-primary" onClick={() => router.push('/dashboard')}>
              Go to dashboard
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void accept()}>
              {loading ? 'Checking...' : 'Accept invitation'}
            </button>
          )}
          {status === 'needs-sign-in' ? <Link className="btn" href={signInHref}>Sign in with invited email</Link> : null}
        </div>
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
