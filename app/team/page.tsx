'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { normalizePlan, hasTeamManagement, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContext } from '@/lib/organization';
import { canManageTeam, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Member = {
  user_id: string;
  role: string;
  active: boolean;
  profiles?: { email: string | null; full_name: string | null } | null;
};

export default function TeamPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [orgId, setOrgId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
      setMessage('Organization not found. Complete onboarding first.');
      return;
    }

    setOrgId(org.organizationId);
    setRole(org.role);

    const { data, error } = await supabase
      .from('organization_members')
      .select('user_id, role, active')
      .eq('organization_id', org.organizationId)
      .order('created_at');

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    const rows = data || [];
    const ids = rows.map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, email, full_name').in('id', ids)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    setMembers(
      rows.map((r) => ({
        ...r,
        profiles: profileMap.get(r.user_id) || null
      }))
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function sendInvite() {
    if (!canManageTeam(role) || !email.trim()) return;
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
      setMessage(json.error || 'Invite failed');
      return;
    }
    setInviteUrl(json.acceptUrl);
    setMessage('Invitation created. Share the accept link with your teammate.');
    setEmail('');
    load();
  }

  async function updateMember(userId: string, patch: { role?: string; active?: boolean }) {
    setBusy(true);
    const res = await fetch('/api/team/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...patch })
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error || 'Update failed');
      return;
    }
    load();
  }

  async function removeMember(userId: string) {
    setBusy(true);
    const res = await fetch(`/api/team/members?userId=${userId}`, { method: 'DELETE' });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error || 'Remove failed');
      return;
    }
    load();
  }

  const teamEnabled = hasTeamManagement(plan);

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} role={role} />
      <main className="main">
        <h2>Team</h2>
        <p>Invite members, manage roles, and control access.</p>

        {!teamEnabled && (
          <div className="card">
            <p>Team management requires Business, Operations, Growth, or Enterprise.</p>
          </div>
        )}

        {teamEnabled && canManageTeam(role) && (
          <div className="card form" style={{ marginTop: 18 }}>
            <h3>Invite by email</h3>
            <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
              <option value="contractor">Contractor</option>
              <option value="client">Client</option>
            </select>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={sendInvite}>
              Send invitation
            </button>
            <button type="button" className="btn" disabled={busy || !email.trim()} onClick={sendInvite}>
              Resend invite
            </button>
            {inviteUrl && (
              <p>
                Accept link: <a href={inviteUrl}>{inviteUrl}</a>
              </p>
            )}
          </div>
        )}

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Member directory</h3>
          {loading && <p>Loading team...</p>}
          {!loading && members.length === 0 && <p>No members yet.</p>}
          {members.map((m) => (
            <div key={m.user_id} className="list-row">
              <div>
                <strong>{m.profiles?.full_name || m.profiles?.email || m.user_id}</strong>
                <p className="muted">
                  {normalizeRole(m.role)} · {m.active ? 'Active' : 'Inactive'}
                </p>
              </div>
              {canManageTeam(role) && m.role !== 'owner' && (
                <div className="inline-actions">
                  <select
                    className="input"
                    value={normalizeRole(m.role)}
                    onChange={(e) => updateMember(m.user_id, { role: e.target.value })}
                    disabled={busy}
                  >
                    <option value="manager">Manager</option>
                    <option value="employee">Employee</option>
                    <option value="contractor">Contractor</option>
                    <option value="client">Client</option>
                  </select>
                  <button type="button" className="btn" disabled={busy} onClick={() => updateMember(m.user_id, { active: !m.active })}>
                    {m.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" className="btn" disabled={busy} onClick={() => removeMember(m.user_id)}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {message && <p className="card" style={{ marginTop: 12 }}>{message}</p>}
      </main>
    </div>
  );
}
