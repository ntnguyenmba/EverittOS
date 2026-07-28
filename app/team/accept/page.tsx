'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { CLIENT_PORTAL_HOME, CONTRACTOR_PORTAL_HOME } from '@/lib/portal-access';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type AcceptStatus = 'checking' | 'needs-sign-in' | 'accepted' | 'already-accepted' | 'error';

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [message, setMessage] = useState('Checking your invitation...');
  const [status, setStatus] = useState<AcceptStatus>('checking');
  const [loading, setLoading] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<ReturnType<typeof normalizeRole> | null>(null);
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
      setMessage('Next step: sign in with the same email address that received the invite, then return here to open your shared access.');
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

    const role = normalizeRole(json.role);
    const destination =
      typeof json.redirectTo === 'string' && json.redirectTo.startsWith('/')
        ? json.redirectTo
        : isClientRole(role)
          ? CLIENT_PORTAL_HOME
          : isContractorRole(role)
            ? CONTRACTOR_PORTAL_HOME
            : '/dashboard';

    setInviteRole(role);
    setRedirectTo(destination);

    const alreadyAccepted = typeof json.message === 'string' && json.message.toLowerCase().includes('already accepted');
    setStatus(alreadyAccepted ? 'already-accepted' : 'accepted');

    if (isClientRole(role)) {
      setMessage(
        alreadyAccepted
          ? 'You already have access. Opening your shared job…'
          : 'Invitation accepted. Opening your shared job…'
      );
      router.replace(destination);
      return;
    }

    if (isContractorRole(role)) {
      setMessage(
        alreadyAccepted
          ? 'You already have contractor access. Opening your portal…'
          : 'Invitation accepted. Opening your contractor portal…'
      );
      router.replace(destination);
      return;
    }

    setMessage(
      alreadyAccepted
        ? 'You are already connected to this workspace. No further action is needed.'
        : 'Invitation accepted. You are now connected to the workspace.'
    );
  }, [router, token]);

  useEffect(() => {
    void accept();
  }, [accept]);

  const isClientInvite = inviteRole != null && isClientRole(inviteRole);
  const isContractorInvite = inviteRole != null && isContractorRole(inviteRole);
  const isPortalInvite = isClientInvite || isContractorInvite;
  const ctaLabel = isClientInvite ? 'Open shared job' : isContractorInvite ? 'Open contractor portal' : 'Continue';

  return (
    <AuthenticatedSection>
      <div className="card form">
        <p className="eyebrow">{isPortalInvite ? 'EverittOS shared access' : 'EverittOS team access'}</p>
        <h2>
          {isClientInvite
            ? 'Accept shared job invitation'
            : isContractorInvite
              ? 'Accept contractor invitation'
              : 'Accept team invitation'}
        </h2>
        <p>
          {isClientInvite
            ? 'This page connects your signed-in account so you can view the shared job. Use the same email address that received the invitation.'
            : 'This page connects your signed-in account to the business workspace. Use the same email address that received the invitation.'}
        </p>
        <div className="auth-message" role="status">
          <strong>
            {status === 'accepted' || status === 'already-accepted'
              ? 'All set'
              : status === 'needs-sign-in'
                ? 'Sign in required'
                : status === 'error'
                  ? 'Action needed'
                  : 'Checking'}
          </strong>
          <p>{message}</p>
        </div>
        <div className="inline-actions">
          {status === 'accepted' || status === 'already-accepted' ? (
            <button type="button" className="btn btn-primary" onClick={() => router.push(redirectTo || '/dashboard')}>
              {ctaLabel}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void accept()}>
              {loading ? 'Checking...' : 'Accept invitation'}
            </button>
          )}
          {status === 'needs-sign-in' ? (
            <Link className="btn" href={signInHref}>
              Sign in with invited email
            </Link>
          ) : null}
        </div>
      </div>
    </AuthenticatedSection>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <AuthenticatedSection>
          <div className="card">Loading...</div>
        </AuthenticatedSection>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
