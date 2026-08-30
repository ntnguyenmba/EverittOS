'use client';

import { EmptyState } from '@/components/empty-state';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { normalizePlan, hasTeamManagement, type EverittosPlan } from '@/lib/everittos-plans';
import { getTeamManageCopy } from '@/lib/i18n/team-manage-copy';
import { formatLastSeenAt } from '@/lib/last-seen';
import { canManageTeam, canModifyTeamMember, isOwner, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

interface Profile {
  email: string | null;
  full_name: string | null;
  updated_at: string | null;
  last_seen_at: string | null;
}

interface ProfileRow extends Profile { id: string }
interface MemberRow { user_id: string; role: string; active: boolean; created_at: string | null }
interface Member extends MemberRow { profiles: Profile | null }
interface Invitation { id: string; email: string; role: string; status: string; created_at: string; expires_at: string | null }
interface AuditItem { id: string; action: string; message: string | null; actor_name: string | null; created_at: string | null }

type AccordionKey =
  | 'invite-by-email'
  | 'transfer-ownership'
  | 'active-users'
  | 'pending-invitations'
  | 'revoked-invitations'
  | 'team-audit-history';

type AccordionState = Record<AccordionKey, boolean>;

const TEAM_ACCORDION_STORAGE_KEY = 'everittos.settings.team.accordion.v3';
const TEAM_ACCORDION_DEFAULTS: AccordionState = {
  'invite-by-email': false,
  'transfer-ownership': false,
  'active-users': false,
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
  return {
    user_id: record.user_id,
    role: record.role,
    active: record.active,
    created_at: 'created_at' in record ? nullableString(record.created_at) : null
  };
}

function parseProfileRow(record: object): ProfileRow | null {
  if (!('id' in record) || typeof record.id !== 'string') return null;
  return {
    id: record.id,
    email: 'email' in record ? nullableString(record.email) : null,
    full_name: 'full_name' in record ? nullableString(record.full_name) : null,
    updated_at: 'updated_at' in record ? nullableString(record.updated_at) : null,
    last_seen_at: 'last_seen_at' in record ? nullableString(record.last_seen_at) : null
  };
}

function parseInvitation(record: object): Invitation | null {
  if (!('id' in record) || typeof record.id !== 'string') return null;
  if (!('email' in record) || typeof record.email !== 'string') return null;
  if (!('role' in record) || typeof record.role !== 'string') return null;
  if (!('status' in record) || typeof record.status !== 'string') return null;
  if (!('created_at' in record) || typeof record.created_at !== 'string') return null;
  return {
    id: record.id,
    email: record.email,
    role: record.role,
    status: record.status,
    created_at: record.created_at,
    expires_at: 'expires_at' in record ? nullableString(record.expires_at) : null
  };
}

function parseAuditItem(record: object): AuditItem | null {
  if (!('id' in record) || typeof record.id !== 'string') return null;
  if (!('action' in record) || typeof record.action !== 'string') return null;
  return {
    id: record.id,
    action: record.action,
    message: 'message' in record ? nullableString(record.message) : null,
    actor_name: 'actor_name' in record ? nullableString(record.actor_name) : null,
    created_at: 'created_at' in record ? nullableString(record.created_at) : null
  };
}

function latestInvitationPerRecipient(invitations: Invitation[]) {
  const seen = new Set<string>();
  return invitations.filter((invitation) => {
    const key = `${invitation.email.trim().toLowerCase()}::${normalizeRole(invitation.role)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function memberDisplayName(member: Member) {
  return member.profiles?.full_name || member.profiles?.email || 'Pending profile';
}

function memberLastActive(member: Member) {
  return formatLastSeenAt(member.profiles?.last_seen_at);
}

function readAccordionState(): AccordionState {
  if (typeof window === 'undefined') return TEAM_ACCORDION_DEFAULTS;
  try {
    const saved = window.localStorage.getItem(TEAM_ACCORDION_STORAGE_KEY);
    return saved ? { ...TEAM_ACCORDION_DEFAULTS, ...JSON.parse(saved) } : TEAM_ACCORDION_DEFAULTS;
  } catch {
    return TEAM_ACCORDION_DEFAULTS;
  }
}

function SettingsAccordion({ id, title, open, onToggle, children }: { id: AccordionKey; title: string; open: boolean; onToggle: (id: AccordionKey) => void; children: ReactNode }) {
  const panelId = `${id}-panel`;
  const headerId = `${id}-header`;
  return (
    <section className="settings-card" id={id}>
      <button id={headerId} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => onToggle(id)} style={{ alignItems: 'center', background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', display: 'flex', gap: '1rem', justifyContent: 'space-between', padding: 0, textAlign: 'left', width: '100%' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span aria-hidden="true" style={{ display: 'inline-flex', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 220ms ease' }}>v</span>
      </button>
      <div id={panelId} role="region" aria-labelledby={headerId} style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 250ms ease' }}>
        <div style={{ overflow: 'hidden' }}>{open ? <div style={{ paddingTop: '1rem' }}>{children}</div> : null}</div>
      </div>
    </section>
  );
}

type TeamManagementPanelProps = { showPermissionMatrix?: boolean; showAuditHistory?: boolean };

export function TeamManagementPanel({ showAuditHistory = false }: TeamManagementPanelProps) {
  const router = useRouter();
  const feedback = useAppFeedback();
  const { locale } = useTranslation();
  const c = getTeamManageCopy(locale);
  const { busy, run, runResponse, buttonLabel } = useAsyncAction({ successMessage: 'invited' });
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
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
  const canViewAuditHistory = role === 'owner' || role === 'admin';

  function toggleAccordion(id: AccordionKey) {
    setAccordionState((current) => {
      const next = { ...current, [id]: !current[id] };
      try { window.localStorage.setItem(TEAM_ACCORDION_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function openInviteFromHash() {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#invite-by-email') return;
    setAccordionState((current) => {
      const next = { ...current, 'invite-by-email': true };
      try { window.localStorage.setItem(TEAM_ACCORDION_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    window.setTimeout(() => {
      document.getElementById('invite-by-email')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('invite-email')?.focus();
    }, 80);
  }

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    setPlan(normalizePlan(profile?.plan));
    const org = await ensureOrganizationForUser(user.id);
    if (!org) {
      setLoading(false);
      feedback.error('Your company is still setting up. Refresh the page or open the dashboard to continue.');
      return;
    }

    setRole(org.role);
    const { data, error } = await supabase.from('organization_members').select('user_id, role, active, created_at').eq('organization_id', org.organizationId).order('created_at');
    if (error) { setLoading(false); feedback.error(error.message); return; }

    const rows: MemberRow[] = [];
    for (const record of data ?? []) {
      const parsed = parseMemberRow(record);
      if (parsed) rows.push(parsed);
    }
    const ids = rows.map((row) => row.user_id);
    const profileRows = ids.length ? (await supabase.from('profiles').select('id, email, full_name, updated_at, last_seen_at').in('id', ids)).data : [];
    const profileMap = new Map<string, Profile>();
    for (const record of profileRows ?? []) {
      const parsed = parseProfileRow(record);
      if (parsed) profileMap.set(parsed.id, parsed);
    }
    setMembers(rows.map((row) => ({ ...row, profiles: profileMap.get(row.user_id) ?? null })));

    if (canManageTeam(org.role)) {
      const { data: inviteRows } = await supabase.from('organization_invitations').select('id, email, role, status, created_at, expires_at').eq('organization_id', org.organizationId).in('status', ['pending', 'revoked', 'expired']).order('created_at', { ascending: false });
      const parsedInvitations: Invitation[] = [];
      for (const record of inviteRows ?? []) {
        const parsed = parseInvitation(record);
        if (parsed) parsedInvitations.push(parsed);
      }
      setInvitations(latestInvitationPerRecipient(parsedInvitations));
    } else {
      setInvitations([]);
    }

    if (showAuditHistory && (org.role === 'owner' || org.role === 'admin')) {
      const { data: auditRows } = await supabase.from('activity_logs').select('id, action, message, actor_name, created_at').eq('organization_id', org.organizationId).in('entity_type', ['member', 'invitation', 'organization']).order('created_at', { ascending: false }).limit(25);
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
    void load();
  }, []);

  useEffect(() => {
    openInviteFromHash();
    window.addEventListener('hashchange', openInviteFromHash);
    return () => window.removeEventListener('hashchange', openInviteFromHash);
  }, []);

  async function sendInvite() {
    if (!canManage || !email.trim() || busy) return;
    setInviteUrl('');
    await run(async () => {
      const res = await fetch('/api/team/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), role: inviteRole, note: inviteNote.trim() || undefined }) });
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
    try { await navigator.clipboard.writeText(inviteUrl); feedback.success(FEEDBACK.copied); } catch { feedback.error('Copy the link manually.'); }
  }

  async function resendInvite(invitationId: string) {
    const res = await runResponse(() => fetch('/api/team/invitations/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invitationId }) }), 'sent');
    if (!res) return;
    const json = await res.json();
    if (json.acceptUrl) setInviteUrl(json.acceptUrl);
    void load();
  }

  async function revokeInvite(invitationId: string) {
    if (!window.confirm('Revoke this invitation? The accept link will stop working.')) return;
    const res = await runResponse(() => fetch('/api/team/invitations/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invitationId }) }), 'deleted');
    if (res) void load();
  }

  async function updateMember(userId: string, patch: { role?: string; active?: boolean }) {
    if (patch.active === false && !window.confirm('Deactivate this member? They will lose access until reactivated.')) return;
    const res = await runResponse(() => fetch('/api/team/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, ...patch }) }), 'updated');
    if (res) void load();
  }

  async function removeMember(userId: string) {
    if (!window.confirm('Remove this member from the company? They will lose access immediately.')) return;
    const res = await runResponse(() => fetch(`/api/team/members?userId=${userId}`, { method: 'DELETE' }), 'deleted');
    if (res) void load();
  }

  async function transferOwnership() {
    if (!transferTarget) return;
    if (!window.confirm('Transfer ownership to this member? You will become an admin and lose owner-only controls. This cannot be undone from the UI.')) return;
    const res = await runResponse(() => fetch('/api/team/transfer-ownership', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: transferTarget }) }), 'updated');
    if (!res) return;
    setTransferTarget('');
    void load();
  }

  const teamEnabled = hasTeamManagement(plan);
  const pendingInvites = invitations.filter((invitation) => invitation.status === 'pending');
  const revokedInvites = invitations.filter((invitation) => invitation.status !== 'pending');
  const activeMembers = members.filter((member) => member.active);

  return (
    <>
      {!teamEnabled ? <div className="settings-card plan-gate-card"><p>{c.planGate}</p><a className="btn btn-primary" href="/settings/billing?upgrade=business">{c.upgrade}</a></div> : null}

      {teamEnabled && canManage ? (
        <SettingsAccordion id="invite-by-email" title={c.inviteTitle} open={accordionState['invite-by-email']} onToggle={toggleAccordion}>
          <label htmlFor="invite-email">{c.email}</label>
          <input id="invite-email" className="input" type="email" placeholder={c.emailPlaceholder} value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="invite-role">{c.role}</label>
          <select id="invite-role" className="input" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
            <option value="manager">{c.manager}</option>
            <option value="employee">{c.employee}</option>
            <option value="contractor">{c.contractor}</option>
            <option value="client">{c.client}</option>
            {isOwner(role) ? <option value="admin">{c.admin}</option> : null}
            <option value="viewer">{c.viewer}</option>
          </select>
          <label htmlFor="invite-note">{c.note}</label>
          <textarea id="invite-note" className="input" rows={2} placeholder={c.notePlaceholder} value={inviteNote} onChange={(event) => setInviteNote(event.target.value)} />
          <button type="button" className="btn btn-primary" disabled={busy || !email.trim()} onClick={() => void sendInvite()}>{buttonLabel(c.sendInvite, FEEDBACK.loading)}</button>
          {inviteUrl ? <div className="invite-link-row"><code className="invite-link-code">{inviteUrl}</code><button type="button" className="btn btn-sm" onClick={() => void copyInviteLink()}>{c.copyLink}</button></div> : null}
        </SettingsAccordion>
      ) : null}

      <SettingsAccordion id="active-users" title={`${c.manageAccess} (${activeMembers.length} ${c.active})`} open={accordionState['active-users']} onToggle={toggleAccordion}>
        {loading ? <p className="loading-state">{c.loading}</p> : null}
        {!loading && members.length === 0 ? <EmptyState title={c.noMembersTitle} description={c.noMembersBody} /> : null}
        {members.map((member) => (
          <div key={member.user_id} className="list-row">
            <div>
              <strong>{memberDisplayName(member)}</strong>
              <p className="muted">{normalizeRole(member.role)} · {member.active ? c.active : 'inactive'}</p>
              <p className="muted">{c.joined} {formatDate(member.created_at)} · {c.lastActive} {memberLastActive(member)}</p>
            </div>
            {canModifyTeamMember(role, normalizeRole(member.role)) ? (
              <div className="inline-actions">
                <select className="input" value={normalizeRole(member.role)} onChange={(event) => void updateMember(member.user_id, { role: event.target.value })} disabled={busy}>
                  {isOwner(role) ? <option value="admin">{c.admin}</option> : null}
                  <option value="manager">{c.manager}</option>
                  <option value="employee">{c.employee}</option>
                  <option value="contractor">{c.contractor}</option>
                  <option value="viewer">{c.viewer}</option>
                  <option value="client">{c.client}</option>
                </select>
                <button type="button" className="btn" disabled={busy} onClick={() => void updateMember(member.user_id, { active: !member.active })}>{member.active ? c.deactivate : c.reactivate}</button>
                <button type="button" className="btn" disabled={busy} onClick={() => void removeMember(member.user_id)}>{c.remove}</button>
              </div>
            ) : null}
          </div>
        ))}
      </SettingsAccordion>

      {teamEnabled && canManage ? (
        <SettingsAccordion id="pending-invitations" title={`${c.pendingTitle} (${pendingInvites.length})`} open={accordionState['pending-invitations']} onToggle={toggleAccordion}>
          {pendingInvites.length === 0 ? <p className="muted">{c.noPending}</p> : null}
          {pendingInvites.map((invitation) => <div key={invitation.id} className="list-row"><div><strong>{invitation.email}</strong><p className="muted">{normalizeRole(invitation.role)} · {c.sent} {formatDate(invitation.created_at)}{invitation.expires_at ? ` · ${c.expires} ${formatDate(invitation.expires_at)}` : ''}</p></div><div className="inline-actions"><button type="button" className="btn" disabled={busy} onClick={() => void resendInvite(invitation.id)}>{c.resend}</button><button type="button" className="btn" disabled={busy} onClick={() => void revokeInvite(invitation.id)}>{c.revoke}</button></div></div>)}
        </SettingsAccordion>
      ) : null}

      {teamEnabled && canManage && revokedInvites.length > 0 ? (
        <SettingsAccordion id="revoked-invitations" title={`${c.historyTitle} (${revokedInvites.length})`} open={accordionState['revoked-invitations']} onToggle={toggleAccordion}>
          {revokedInvites.map((invitation) => <div key={invitation.id} className="list-row"><div><strong>{invitation.email}</strong><p className="muted">{normalizeRole(invitation.role)} · {invitation.status} · {c.sent} {formatDate(invitation.created_at)}</p></div></div>)}
        </SettingsAccordion>
      ) : null}

      {teamEnabled && isOwner(role) && members.some((member) => member.role !== 'owner' && member.active) ? (
        <SettingsAccordion id="transfer-ownership" title={c.transferTitle} open={accordionState['transfer-ownership']} onToggle={toggleAccordion}>
          <select className="input" value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)}>
            <option value="">{c.selectMember}</option>
            {members.filter((member) => member.role !== 'owner' && member.active).map((member) => <option key={member.user_id} value={member.user_id}>{memberDisplayName(member)}</option>)}
          </select>
          <button type="button" className="btn" disabled={busy || !transferTarget} onClick={() => void transferOwnership()}>{buttonLabel(c.transferButton, FEEDBACK.loading)}</button>
        </SettingsAccordion>
      ) : null}

      {showAuditHistory && canViewAuditHistory ? (
        <SettingsAccordion id="team-audit-history" title={`Team audit history (${auditItems.length})`} open={accordionState['team-audit-history']} onToggle={toggleAccordion}>
          {auditItems.length === 0 ? <p className="muted">No audit history yet.</p> : null}
          {auditItems.map((item) => <div key={item.id} className="list-row compact"><div><strong>{item.message || item.action}</strong><p className="muted">{item.actor_name || 'System'} · {formatDate(item.created_at)}</p></div></div>)}
        </SettingsAccordion>
      ) : null}
    </>
  );
}
