'use client';

import { EmptyState } from '@/components/empty-state';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { normalizePlan, hasTeamManagement, type EverittosPlan } from '@/lib/everittos-plans';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { canManageTeam, canModifyTeamMember, canViewTeam, isOwner, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, type ReactNode } from 'react';
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

type AccordionKey =
  | 'invite-by-email'
  | 'transfer-ownership'
  | 'team-access'
  | 'active-users'
  | 'pending-invitations'
  | 'revoked-invitations'
  | 'team-audit-history';

type AccordionState = Record<AccordionKey, boolean>;

const TEAM_ACCORDION_STORAGE_KEY = 'everittos.settings.team.accordion.v1';
const TEAM_ACCORDION_DEFAULTS: AccordionState = {
  'invite-by-email': true,
  'transfer-ownership': false,
  'team-access': false,
  'active-users': true,
  'pending-invitations': false,
  'revoked-invitations': false,
  'team-audit-history': false
};

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

function memberDisplayName(member: Member) {
  return member.profiles?.full_name || member.profiles?.email || 'Pending profile';
}

function memberLastActive(member: Member) {
  return member.profiles?.updated_at ? formatDate(member.profiles.updated_at) : 'Never';
}

function readAccordionState(): AccordionState {
  if (typeof window === 'undefined') return TEAM_ACCORDION_DEFAULTS;
  try {
    const saved = window.localStorage.getItem(TEAM_ACCORDION_STORAGE_KEY);
    if (!saved) return TEAM_ACCORDION_DEFAULTS;
    return { ...TEAM_ACCORDION_DEFAULTS, ...JSON.parse(saved) };
  } catch {
    return TEAM_ACCORDION_DEFAULTS;
  }
}

function SettingsAccordion({
  id,
  title,
  open,
  onToggle,
  children
}: {
  id: AccordionKey;
  title: string;
  open: boolean;
  onToggle: (id: AccordionKey) => void;
  children: ReactNode;
}) {
  const panelId = `${id}-panel`;
  const headerId = `${id}-header`;

  return (
    <section className="settings-card">
      <button
        id={headerId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onToggle(id)}
        style={{
          alignItems: 'center',
          background: 'transparent',
          border: 0,
          color: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          gap: '1rem',
          justifyContent: 'space-between',
          padding: 0,
          textAlign: 'left',
          width: '100%'
        }}
      >
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 220ms ease'
          }}
        >
          v
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 250ms ease'
        }}
      >
        <div style={{ overflow: 'hidden' }}>{open ? <div style={{ paddingTop: '1rem' }}>{children}</div> : null}</div>
      </div>
    </section>
  );
}

type TeamManagementPanelProps = {
  showPermissionMatrix?: boolean;
  showAuditHistory?: boolean;
};

export function TeamManagementPanel({ showAuditHistory = false }: TeamManagementPanelProps) {
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
  const [accordionState, setAccordionState] = useState<AccordionState>(TEAM_ACCORDION_DEFAULTS);

  const canManage = canManageTeam(role);
  const canView = canViewTeam(role);
  const canViewAuditHistory = role === 'owner' || role === 'admin';

  function toggleAccordion(id: AccordionKey) {
    setAccordionState((current) => {
      const next = { ...current, [id]: !current[id] };
      try {
        window.localStorage.setItem(TEAM_ACCORDION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Keep the accordion usable even when localStorage is unavailable.
      }
      return next;
    });
  }

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

    if (canManageTeam(org.role)) {
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
    } else {
      setInvitations([]);
    }

    if (showAuditHistory && (org.role === 'owner' || org.role === 'admin')) {
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
    setAccordionState(readAccordionState());
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
  const revokedInvites = invitations.filter((i) => i.status !== 'pending');
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
        <SettingsAccordion id="invite-by-email" title="Invite by email" open={accordionState['invite-by-email']} onToggle={toggleAccordion}>
          <p className="muted">Invited team members join this workspace. Customers and jobs they add are shared with the business.</p>
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
            <option value="employee">Worker</option>
            <option value="contractor">Contractor</option>
            <option value="client">Client</option>
            {isOwner(role) ? <option value="admin">Admin</option> : null}
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
        </SettingsAccordion>
      )}

      {teamEnabled && isOwner(role) && members.filter((m) => m.role !== 'owner' && m.active).length > 0 && (
        <SettingsAccordion
          id="transfer-ownership"
          title="Transfer ownership"
          open={accordionState['transfer-ownership']}
          onToggle={toggleAccordion}
        >
          <p className="muted">Assign a new owner. You will become an admin.</p>
          <select className="input" value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)}>
            <option value="">Select member...</option>
            {members
              .filter((m) => m.role !== 'owner' && m.active)
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {memberDisplayName(m)}
                </option>
              ))}
          </select>
          <button type="button" className="btn" disabled={busy || !transferTarget} onClick={() => void transferOwnership()}>
            {buttonLabel('Transfer ownership', FEEDBACK.loading)}
          </button>
        </SettingsAccordion>
      )}

      {teamEnabled && (
        <SettingsAccordion id="team-access" title="Team access" open={accordionState['team-access']} onToggle={toggleAccordion}>
          <p className="muted">Simple role guide for this workspace.</p>
          <div className="list-row compact">
            <div>
              <strong>Owner</strong>
              <p className="muted">Full access to the business, billing, team, jobs, customers, reports, and settings.</p>
            </div>
          </div>
          <div className="list-row compact">
            <div>
              <strong>Admin</strong>
              <p className="muted">Can manage operations, team members, jobs, customers, schedules, and reports.</p>
            </div>
          </div>
          <div className="list-row compact">
            <div>
              <strong>Worker</strong>
              <p className="muted">Can work from assigned jobs and add updates without seeing owner-only controls.</p>
            </div>
          </div>
          <div className="list-row compact">
            <div>
              <strong>Contractor</strong>
              <p className="muted">Can be invited as an outside team member while staying separate from employees.</p>
            </div>
          </div>
          <div className="list-row compact">
            <div>
              <strong>Viewer</strong>
              <p className="muted">Read-only access for reviewing shared workspace information.</p>
            </div>
          </div>
        </SettingsAccordion>
      )}

      <SettingsAccordion id="active-users" title={`Active users (${activeMembers.length})`} open={accordionState['active-users']} onToggle={toggleAccordion}>
        {loading ? <p className="loading-state">Loading team...</p> : null}
        {!loading && members.length === 0 ? (
          <EmptyState title="No members yet" description="Invite teammates to share access to jobs and customers." />
        ) : null}
        {members.map((m) => (
          <div key={m.user_id} className="list-row">
            <div>
              <strong>{memberDisplayName(m)}</strong>
              <p className="muted">
                {normalizeRole(m.role)} · {m.active ? 'Active' : 'Inactive'}
              </p>
              <p className="muted">
                Joined {formatDate(m.created_at)} · Last active {memberLastActive(m)}
              </p>
            </div>
            {canModifyTeamMember(role, normalizeRole(m.role)) ? (
              <div className="inline-actions">
                <select
                  className="input"
                  value={normalizeRole(m.role)}
                  onChange={(e) => updateMember(m.user_id, { role: e.target.value })}
                  disabled={busy}
                >
                  {isOwner(role) ? <option value="admin">Admin</option> : null}
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
            ) : null}
          </div>
        ))}
      </SettingsAccordion>

      {teamEnabled && canManage ? (
        <SettingsAccordion
          id="pending-invitations"
          title={`Pending invitations (${pendingInvites.length})`}
          open={accordionState['pending-invitations']}
          onToggle={toggleAccordion}
        >
          {pendingInvites.length === 0 ? <p className="muted">No pending invitations.</p> : null}
          {pendingInvites.map((inv) => (
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
              <div className="inline-actions">
                <button type="button" className="btn" disabled={busy} onClick={() => resendInvite(inv.id)}>
                  Resend
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => revokeInvite(inv.id)}>
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </SettingsAccordion>
      ) : null}

      {teamEnabled && canManage ? (
        <SettingsAccordion
          id="revoked-invitations"
          title={`Revoked invitations (${revokedInvites.length})`}
          open={accordionState['revoked-invitations']}
          onToggle={toggleAccordion}
        >
          {revokedInvites.length === 0 ? <p className="muted">No revoked or expired invitations.</p> : null}
          {revokedInvites.map((inv) => (
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
            </div>
          ))}
        </SettingsAccordion>
      ) : null}

      {showAuditHistory && canViewAuditHistory ? (
        <SettingsAccordion
          id="team-audit-history"
          title={`Team audit history (${auditItems.length})`}
          open={accordionState['team-audit-history']}
          onToggle={toggleAccordion}
        >
          {auditItems.length === 0 ? <p className="muted">No audit history yet.</p> : null}
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
        </SettingsAccordion>
      ) : null}
    </>
  );
}
