'use client';

import { PermissionMatrix } from '@/components/team/permission-matrix';
import { EmptyState } from '@/components/empty-state';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { normalizePlan, hasTeamManagement, type EverittosPlan } from '@/lib/everittos-plans';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { canManageTeam, canViewTeam, isOwner, normalizeRole, type UserRole } from '@/lib/roles';
import { PERMISSION_LABELS, permissionsForRole } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Profile {
  email: string | null;
  full_name: string | null;
  updated_at: string | null;
}

interface ProfileRow extends Profile {
  id: string;
}

interface MemberRow {
  user_id: string;
  role: string;
  active: boolean;
  created_at: string | null;
}

interface Member extends MemberRow {
  profiles: Profile | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string | null;
}

interface AuditItem {
  id: string;
  action: string;
  message: string | null;
  actor_name: string | null;
  created_at: string | null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseMemberRow(record: object): MemberRow | null {
  if (!('user_id' in record) || typeof record.user_id !== 'string') return null;
  if (!('role' in record) || typeof record.role !== 'string') return null;
  if (!('active' in record) || typeof record.active !== 'boolean') return null;
  const createdAt = 'created_at' in record ? record.created_at : null;

  return {
    user_id: record.user_id,
    role: record.role,
    active: record.active,
    created_at: nullableString(createdAt)
  };
}

function parseProfileRow(record: object): ProfileRow | null {
  if (!('id' in record) || typeof record.id !== 'string') return null;

  return {
    id: record.id,
    email: 'email' in record ? nullableString(record.email) : null,
    full_name: 'full_name' in record ? nullableString(record.full_name) : null,
    updated_at: 'updated_at' in record ? nullableString(record.updated_at) : null
  };
}

function toProfile(row: ProfileRow): Profile {
  return {
    email: row.email,
    full_name: row.full_name,
    updated_at: row.updated_at
  };
}

function buildProfileMap(records: object[]): Map<string, Profile> {
  const profileMap = new Map<string, Profile>();
  for (const record of records) {
    const parsed = parseProfileRow(record);
    if (!parsed) continue;
    profileMap.set(parsed.id, toProfile(parsed));
  }
  return profileMap;
}

function buildMembers(rows: MemberRow[], profileMap: Map<string, Profile>): Member[] {
  return rows.map((row): Member => ({
    ...row,
    profiles: profileMap.get(row.user_id) ?? null
  }));
}

function parseInvitation(record: object): Invitation | null {
  if (!('id' in record) || typeof record.id !== 'string') return null;
  if (!('email' in record) || typeof record.email !== 'string') return null;
  if (!('role' in record) || typeof record.role !== 'string') return null;
  if (!('status' in record) || typeof record.status !== 'string') return null;
  if (!('created_at' in record) || typeof record.created_at !== 'string') return null;

  const expiresAt = 'expires_at' in record ? record.expires_at : null;

  return {
    id: record.id,
    email: record.email,
    role: record.role,
    status: record.status,
    created_at: record.created_at,
    expires_at: nullableString(expiresAt)
  };
}

function parseAuditItem(record: object): AuditItem | null {
  if (!('id' in record) || typeof record.id !== 'string') return null;
  if (!('action' in record) || typeof record.action !== 'string') return null;

  const message = 'message' in record ? record.message : null;
  const actorName = 'actor_name' in record ? record.actor_name : null;
  const createdAt = 'created_at' in record ? record.created_at : null;

  return {
    id: record.id,
    action: record.action,
    message: nullableString(message),
    actor_name: nullableString(actorName),
    created_at: nullableString(createdAt)
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

type TeamManagementPanelProps = {
  showPermissionMatrix?: boolean;
  showAuditHistory?: boolean;
};

export function TeamManagementPanel({ showPermissionMatrix = true, showAuditHistory = false }: TeamManagementPanelProps) {
  const router = useRouter();
  const feedback = useAppFeedback();
  const { busy, run, runResponse, buttonLabel } = useAsyncAction({ successMessage: 'invited' });
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [orgId, setOrgId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviteNote, setInviteNote] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
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

    const org = await ensureOrganizationForUser(user.id);
    if (!org) {
      setLoading(false);
      feedback.error('Workspace is still setting up. Refresh the page or open the dashboard to continue.');
      return;
    }

    setOrgId(org.organizationId);
    setRole(org.role);

    const { data, error } = await supabase
      .from('organization_members')
      .select('user_id, role, active, created_at')
      .eq('organization_id', org.organizationId)
      .order('created_at');

    if (error) {
      setLoading(false);
      feedback.error(error.message);
      return;
    }

    const rows: MemberRow[] = [];
    for (const record of data ?? []) {
      const parsed = parseMemberRow(record);
      if (parsed) rows.push(parsed);
    }

    const ids = rows.map((row) => row.user_id);
    const profileRows = ids.length
      ? (await supabase.from('profiles').select('id, email, full_name, updated_at').in('id', ids)).data
      : [];

    const profileMap = buildProfileMap(profileRows ?? []);
    setMembers(buildMembers(rows, profileMap));

    if (canViewTeam(org.role)) {
      const { data: inviteRows } = await supabase
        .from('organization_invitations')
        .select('id, email, role, status, created_at, expires_at')
        .eq('organization_id', org.organizationId)
        .in('status', ['pending', 'revoked', 'expired'])
        .order('created_at', { ascending: false });

      const invitations: Invitation[] = [];
      for (const record of inviteRows ?? []) {
        const parsed = parseInvitation(record);
        if (parsed) invitations.push(parsed);
      }
      setInvitations(invitations);
    }

    if (showAuditHistory) {
      const { data: auditRows } = await supabase
        .from('activity_logs')
        .select('id, action, message, actor_name, created_at')
        .eq('organization_id', org.organizationId)
        .in('entity_type', ['member', 'invitation', 'organization'])
        .order('created_at', { ascending: false })
        .limit(25);

      const audit: AuditItem[] = [];
      for (const record of auditRows ?? []) {
        const parsed = parseAuditItem(record);
        if (parsed) audit.push(parsed);
      }
      setAuditItems(audit);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function sendInvite() {
    if (!canManage || !email.trim() || busy) return;
    setInviteUrl('');
    await run(async () => {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role: inviteRole, note: inviteNote.trim() || undefined })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(friendlyErrorMessage(json.error || 'Invite failed'));
      setInviteUrl(json.acceptUrl);
      setEmail('');
      setInviteNote('');
      void load();
    });
  }

  async function copyInviteLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      feedback.success(FEEDBACK.copied);
    } catch {
      feedback.error('Copy the link manually.');
    }
  }

  async function resendInvite(invitationId: string) {
    const res = await runResponse(
      () =>
        fetch('/api/team/invitations/resend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitationId })
        }),
      'sent'
    );
    if (!res) return;
    const json = await res.json();
    if (json.acceptUrl) setInviteUrl(json.acceptUrl);
  }

  async function revokeInvite(invitationId: string) {
    if (!window.confirm('Revoke this invitation? The accept link will stop working.')) return;
    const res = await runResponse(
      () =>
        fetch('/api/team/invitations/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitationId })
        }),
      'deleted'
    );
    if (res) load();
  }

  async function updateMember(userId: string, patch: { role?: string; active?: boolean }) {
    if (patch.active === false && !window.confirm('Deactivate this member? They will lose access until reactivated.')) return;
    const res = await runResponse(
      () =>
        fetch('/api/team/members', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ...patch })
        }),
      'updated'
    );
    if (res) load();
  }

  async function removeMember(userId: string) {
    if (!window.confirm('Remove this member from the organization? They will lose access immediately.')) return;
    const res = await runResponse(() => fetch(`/api/team/members?userId=${userId}`, { method: 'DELETE' }), 'deleted');
    if (res) load();
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
    const res = await runResponse(
      () =>
        fetch('/api/team/transfer-ownership', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: transferTarget })
        }),
      'updated'
    );
    if (!res) return;
    await res.json();
    setTransferTarget('');
    load();
  }

  const teamEnabled = hasTeamManagement(plan);
  const pendingInvites = invitations.filter((i) => i.status === 'pending');
  const activeMembers = members.filter((m) => m.active);

  return (
    <>
      {!teamEnabled && (
        <div className="settings-card plan-gate-card">
          <p>Team management requires Business, Growth, or Enterprise.</p>
          <a className="btn btn-primary" href="/settings/billing?upgrade=business">
            Upgrade to Business
          </a>
        </div>
      )}

      {teamEnabled && canManage && (
        <div className="settings-card">
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
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
            <option value="contractor">Contractor</option>
            <option value="client">Client</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          <label htmlFor="invite-note">Note (optional)</label>
          <textarea
            id="invite-note"
            className="input"
            rows={2}
            placeholder="Optional message for the invitee"
            value={inviteNote}
            onChange={(e) => setInviteNote(e.target.value)}
          />
          <button type="button" className="btn btn-primary" disabled={busy || !email.trim()} onClick={() => void sendInvite()}>
            {buttonLabel('Send invitation', FEEDBACK.loading)}
          </button>
          {inviteUrl ? (
            <div className="invite-link-row">
              <p className="muted">Accept link:</p>
              <code className="invite-link-code">{inviteUrl}</code>
              <button type="button" className="btn btn-sm" onClick={() => void copyInviteLink()}>
                Copy link
              </button>
            </div>
          ) : null}
        </div>
      )}

      {teamEnabled && isOwner(role) && members.filter((m) => m.role !== 'owner' && m.active).length > 0 && (
        <div className="settings-card">
          <h3>Transfer ownership</h3>
          <p className="muted">Assign a new owner. You will become an admin.</p>
          <select className="input" value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)}>
            <option value="">Select member…</option>
            {members
              .filter((m) => m.role !== 'owner' && m.active)
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profiles?.full_name || m.profiles?.email || m.user_id}
                </option>
              ))}
          </select>
          <button type="button" className="btn" disabled={busy || !transferTarget} onClick={() => void transferOwnership()}>
            {buttonLabel('Transfer ownership', FEEDBACK.loading)}
          </button>
        </div>
      )}

      <div className="settings-card">
        <h3>Active users ({activeMembers.length})</h3>
        {loading ? <p className="loading-state">Loading team…</p> : null}
        {!loading && members.length === 0 ? (
          <EmptyState title="No members yet" description="Invite teammates to share access to jobs and customers." />
        ) : null}
        {members.map((m) => (
          <div key={m.user_id} className="list-row">
            <div>
              <strong>{m.profiles?.full_name || m.profiles?.email || m.user_id}</strong>
              <p className="muted">
                {normalizeRole(m.role)} · {m.active ? 'Active' : 'Inactive'}
              </p>
              <p className="muted">
                Joined {formatDate(m.created_at)} · Last active {formatDate(m.profiles?.updated_at)}
              </p>
            </div>
            {canManage && m.role !== 'owner' ? (
              <div className="inline-actions">
                <select
                  className="input"
                  value={normalizeRole(m.role)}
                  onChange={(e) => updateMember(m.user_id, { role: e.target.value })}
                  disabled={busy}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="employee">Worker</option>
                  <option value="contractor">Technician</option>
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
            ) : null}
          </div>
        ))}
      </div>

      {teamEnabled && canView ? (
        <div className="settings-card">
          <h3>Pending invitations ({pendingInvites.length})</h3>
          {invitations.length === 0 ? <p className="muted">No invitations yet.</p> : null}
          {invitations.map((inv) => (
            <div key={inv.id} className="list-row">
              <div>
                <strong>{inv.email}</strong>
                <p className="muted">
                  {normalizeRole(inv.role)} · {inv.status}
                </p>
                <p className="muted">
                  Sent {formatDate(inv.created_at)}
                  {inv.expires_at ? ` · Expires ${formatDate(inv.expires_at)}` : ''}
                </p>
              </div>
              {canManage && inv.status === 'pending' ? (
                <div className="inline-actions">
                  <button type="button" className="btn" disabled={busy} onClick={() => resendInvite(inv.id)}>
                    Resend
                  </button>
                  <button type="button" className="btn" disabled={busy} onClick={() => revokeInvite(inv.id)}>
                    Revoke
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {showAuditHistory && auditItems.length > 0 ? (
        <div className="settings-card">
          <h3>Team audit history</h3>
          {auditItems.map((item) => (
            <div key={item.id} className="list-row compact">
              <div>
                <strong>{item.message || item.action}</strong>
                <p className="muted">
                  {item.actor_name || 'System'} · {formatDate(item.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {teamEnabled && showPermissionMatrix ? (
        <div className="settings-card">
          <h3>Permission matrix</h3>
          <p className="muted">Your role ({normalizeRole(role)}) includes:</p>
          <ul>
            {permissionsForRole(role).map((perm) => (
              <li key={perm}>{PERMISSION_LABELS[perm]}</li>
            ))}
          </ul>
          <PermissionMatrix />
        </div>
      ) : null}
    </>
  );
}
