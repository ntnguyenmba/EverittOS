'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { normalizePlan, hasTeamManagement, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContext } from '@/lib/organization';
import { canManageTeam, canViewTeam, isOwner, normalizeRole, type UserRole } from '@/lib/roles';
import { PERMISSION_LABELS, permissionsForRole } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';

type Member = {
  user_id: string;
  role: string;
  active: boolean;
  created_at: string | null;
  profiles?: { email: string | null; full_name: string | null; updated_at: string | null } | null;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function TeamPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [orgId, setOrgId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [busy, setBusy] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');

  const canManage = canManageTeam(role);
  const canView = canViewTeam(role);

  async function load() {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    setPlan(normalizePlan(profile?.plan));

    const org = await fetchOrganizationContext(user.id);
    if (!org) {
      setLoading(false);
      setMessageType('error');
      setMessage('Organization not found. Complete onboarding first.');
      return;
    }

    setOrgId(org.organizationId);
    setRole(org.role);

    const { data, error } = await supabase
      .from('organization_members')
      .select('user_id, role, active, created_at')
      .eq('organization_id', org.organizationId)
      .order('created_at');

    setLoading(false);
    if (error) {
      setMessageType('error');
      setMessage(error.message);
      return;
    }

    const rows = data || [];
    const ids = rows.map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, email, full_name, updated_at').in('id', ids)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    setMembers(
      rows.map((r) => ({
        ...r,
        profiles: profileMap.get(r.user_id) || null
      }))
    );

    if (canViewTeam(org.role)) {
      const { data: inviteRows } = await supabase
        .from('organization_invitations')
        .select('id, email, role, status, created_at, expires_at')
        .eq('organization_id', org.organizationId)
        .in('status', ['pending', 'revoked', 'expired'])
        .order('created_at', { ascending: false });
      setInvitations((inviteRows || []) as Invitation[]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function showSuccess(text: string) {
    setMessageType('success');
    setMessage(text);
  }

  function showError(text: string) {
    setMessageType('error');
    setMessage(text);
  }

  async function sendInvite() {
    if (!canManage || !email.trim()) return;
    setBusy(true);
    setMessage('');
    setInviteUrl('');
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), role: inviteRole })
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      showError(json.error || 'Invite failed');
      return;
    }
    setInviteUrl(json.acceptUrl);
    showSuccess(json.message || 'Invitation sent.');
    setEmail('');
    load();
  }

  async function resendInvite(invitationId: string) {
    setBusy(true);
    const res = await fetch('/api/team/invitations/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId })
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      showError(json.error || 'Resend failed');
      return;
    }
    if (json.acceptUrl) setInviteUrl(json.acceptUrl);
    showSuccess(json.message || 'Invitation resent.');
  }

  async function revokeInvite(invitationId: string) {
    if (!window.confirm('Revoke this invitation? The accept link will stop working.')) return;
    setBusy(true);
    const res = await fetch('/api/team/invitations/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId })
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      showError(json.error || 'Revoke failed');
      return;
    }
    showSuccess('Invitation revoked.');
    load();
  }

  async function updateMember(userId: string, patch: { role?: string; active?: boolean }) {
    if (patch.active === false && !window.confirm('Deactivate this member? They will lose access until reactivated.')) return;
    setBusy(true);
    const res = await fetch('/api/team/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...patch })
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      showError(json.error || 'Update failed');
      return;
    }
    showSuccess(patch.active === false ? 'Member deactivated.' : patch.active === true ? 'Member reactivated.' : 'Role updated.');
    load();
  }

  async function removeMember(userId: string) {
    if (!window.confirm('Remove this member from the organization? They will lose access immediately.')) return;
    setBusy(true);
    const res = await fetch(`/api/team/members?userId=${userId}`, { method: 'DELETE' });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      showError(json.error || 'Remove failed');
      return;
    }
    showSuccess('Member removed.');
    load();
  }

  async function transferOwnership() {
    if (!transferTarget) return;
    if (
      !window.confirm(
        'Transfer ownership to this member? You will become an admin and lose owner-only controls. This cannot be undone from the UI.'
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch('/api/team/transfer-ownership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: transferTarget })
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      showError(json.error || 'Transfer failed');
      return;
    }
    showSuccess(json.message || 'Ownership transferred.');
    setTransferTarget('');
    load();
  }

  const teamEnabled = hasTeamManagement(plan);
  const pendingInvites = invitations.filter((i) => i.status === 'pending');

  return (
    <AppShell plan={plan} role={role}>
      <h1>Team</h1>
      <p className="muted">Invite members, manage roles, and control access.</p>

      {!teamEnabled && (
        <div className="card">
          <p>Team management requires Business, Operations, Growth, or Enterprise.</p>
        </div>
      )}

      {teamEnabled && canManage && (
        <div className="card form" style={{ marginTop: 18 }}>
          <h3>Invite by email</h3>
          <label htmlFor="invite-email">Email</label>
          <input
            id="invite-email"
            className="input"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="invite-role">Role</label>
          <select id="invite-role" className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="employee">Worker</option>
            <option value="contractor">Contractor</option>
            <option value="viewer">Viewer</option>
            <option value="client">Client</option>
          </select>
          <button type="button" className="btn btn-primary" disabled={busy || !email.trim()} onClick={sendInvite}>
            {busy ? 'Sending…' : 'Send invitation'}
          </button>
          {inviteUrl && (
            <p>
              Accept link: <a href={inviteUrl}>{inviteUrl}</a>
            </p>
          )}
        </div>
      )}

      {teamEnabled && isOwner(role) && members.filter((m) => m.role !== 'owner' && m.active).length > 0 && (
        <div className="card form" style={{ marginTop: 18 }}>
          <h3>Transfer ownership</h3>
          <p className="muted">Assign a new owner. You will become an admin.</p>
          <label htmlFor="transfer-target">New owner</label>
          <select
            id="transfer-target"
            className="input"
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
          >
            <option value="">Select member…</option>
            {members
              .filter((m) => m.role !== 'owner' && m.active)
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profiles?.full_name || m.profiles?.email || m.user_id}
                </option>
              ))}
          </select>
          <button type="button" className="btn" disabled={busy || !transferTarget} onClick={transferOwnership}>
            Transfer ownership
          </button>
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Member directory</h3>
        {loading ? (
          <p className="loading-state" role="status">
            Loading team…
          </p>
        ) : null}
        {!loading && members.length === 0 ? (
          <EmptyState title="No members yet" description="Invite teammates to share access to jobs and customers." />
        ) : null}
        {members.map((m) => (
          <div key={m.user_id} className="list-row">
            <div>
              <strong>{m.profiles?.full_name || m.profiles?.email || m.user_id}</strong>
              <p className="muted">
                {normalizeRole(m.role)} · {m.active ? 'Active' : 'Inactive'}
                {m.role === 'owner' ? ' · Owner' : ''}
              </p>
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                Joined {formatDate(m.created_at)} · Last active {formatDate(m.profiles?.updated_at)}
              </p>
            </div>
            {canManage && m.role !== 'owner' && (
              <div className="inline-actions">
                <select
                  className="input"
                  value={normalizeRole(m.role)}
                  onChange={(e) => updateMember(m.user_id, { role: e.target.value })}
                  disabled={busy}
                  aria-label={`Change role for ${m.profiles?.email || m.user_id}`}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Worker</option>
                  <option value="contractor">Contractor</option>
                  <option value="viewer">Viewer</option>
                  <option value="client">Client</option>
                </select>
                <button type="button" className="btn" disabled={busy} onClick={() => updateMember(m.user_id, { active: !m.active })}>
                  {m.active ? 'Deactivate' : 'Reactivate'}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => removeMember(m.user_id)}>
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {teamEnabled && canView && invitations.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>Invitations</h3>
          {invitations.map((inv) => (
            <div key={inv.id} className="list-row">
              <div>
                <strong>{inv.email}</strong>
                <p className="muted">
                  {normalizeRole(inv.role)} · {inv.status}
                </p>
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  Sent {formatDate(inv.created_at)}
                  {inv.expires_at ? ` · Expires ${formatDate(inv.expires_at)}` : ''}
                </p>
              </div>
              {canManage && inv.status === 'pending' && (
                <div className="inline-actions">
                  <button type="button" className="btn" disabled={busy} onClick={() => resendInvite(inv.id)}>
                    Resend
                  </button>
                  <button type="button" className="btn" disabled={busy} onClick={() => revokeInvite(inv.id)}>
                    Revoke
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {teamEnabled && canView && pendingInvites.length === 0 && members.length > 0 && canManage && (
        <div className="card" style={{ marginTop: 18 }}>
          <EmptyState title="No pending invitations" description="All invitations have been accepted or expired." />
        </div>
      )}

      {teamEnabled && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>Role permissions</h3>
          <p className="muted">Your role ({normalizeRole(role)}) includes:</p>
          <ul>
            {permissionsForRole(role).map((perm) => (
              <li key={perm}>{PERMISSION_LABELS[perm]}</li>
            ))}
          </ul>
        </div>
      )}

      {message ? (
        <p
          className={messageType === 'success' ? 'auth-message auth-message-success' : 'auth-message auth-message-error'}
          style={{ marginTop: 12 }}
          role={messageType === 'error' ? 'alert' : 'status'}
        >
          {friendlyErrorMessage(message)}
        </p>
      ) : null}
    </AppShell>
  );
}
