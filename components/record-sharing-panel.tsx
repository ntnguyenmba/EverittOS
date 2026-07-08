'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeRole } from '@/lib/roles';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';

type RecordSharingPanelProps = {
  organizationId: string;
  recordType: 'job' | 'customer' | 'photo' | 'report' | 'note' | 'document';
  recordId: string;
  canManage: boolean;
};

type MemberOption = {
  user_id: string;
  role: string;
  profile?: ProfileRow | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type ShareRecord = {
  id: string;
  shared_with_user_id: string;
  access_level: string;
  created_at: string | null;
};

function memberLabel(member: MemberOption): string {
  const name = member.profile?.full_name?.trim();
  const email = member.profile?.email?.trim();
  if (name && email) return `${name} (${email})`;
  return name || email || member.user_id;
}

export function RecordSharingPanel({ organizationId, recordType, recordId, canManage }: RecordSharingPanelProps) {
  const feedback = useAppFeedback();
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [accessLevel, setAccessLevel] = useState<'view' | 'edit'>('view');
  const [saving, setSaving] = useState(false);

  async function loadMembers() {
    if (!organizationId) return;
    const { data: memberRows, error } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'manager', 'employee', 'contractor', 'staff', 'crew_lead', 'viewer'])
      .order('role');

    if (error) {
      feedback.error(error.message || 'Unable to load teammates.');
      setMembers([]);
      return;
    }

    const rows = (memberRows || []) as Array<Pick<MemberOption, 'user_id' | 'role'>>;
    const ids = rows.map((member) => member.user_id).filter(Boolean);
    const { data: profileRows } = ids.length
      ? await supabase.from('profiles').select('id, email, full_name').in('id', ids)
      : { data: [] as ProfileRow[] };

    const profiles = new Map<string, ProfileRow>();
    for (const profile of (profileRows || []) as ProfileRow[]) profiles.set(profile.id, profile);

    setMembers(
      rows.map((member) => ({
        ...member,
        profile: profiles.get(member.user_id) || null
      }))
    );
  }

  async function loadShares() {
    if (!recordId) return;
    const res = await fetch(`/api/record-shares?recordType=${recordType}&recordId=${recordId}`);
    const json = (await res.json().catch(() => ({}))) as { shares?: ShareRecord[]; error?: string };
    if (!res.ok) {
      feedback.error(json.error || 'Unable to load sharing.');
      return;
    }
    setShares(json.shares || []);
  }

  useEffect(() => {
    void loadMembers();
    void loadShares();
  }, [organizationId, recordType, recordId]);

  async function addShare() {
    if (!selectedUserId || saving) return;
    setSaving(true);
    const res = await fetch('/api/record-shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordType, recordId, userIds: [selectedUserId], accessLevel })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to share record.');
      return;
    }
    setSelectedUserId('');
    feedback.success(FEEDBACK.updated);
    void loadShares();
  }

  async function removeShare(shareId: string) {
    if (!window.confirm('Remove this shared access?')) return;
    const res = await fetch(`/api/record-shares?id=${shareId}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      feedback.error(json.error || 'Unable to remove shared access.');
      return;
    }
    feedback.success(FEEDBACK.updated);
    void loadShares();
  }

  const shareLookup = new Map(shares.map((share) => [share.shared_with_user_id, share]));
  const availableMembers = members.filter((member) => !shareLookup.has(member.user_id));

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3>Shared with teammates</h3>
      <p className="muted">
        Share this {recordType} with selected teammates so they can view or edit the record.
      </p>

      {canManage ? (
        <div className="form">
          <label>Teammate</label>
          <select className="input" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="">Select teammate...</option>
            {availableMembers.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {memberLabel(member)} · {normalizeRole(member.role)}
              </option>
            ))}
          </select>
          <label>Access</label>
          <select className="input" value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as 'view' | 'edit')}>
            <option value="view">View only</option>
            <option value="edit">Can edit</option>
          </select>
          <button className="btn btn-primary" type="button" disabled={!selectedUserId || saving} onClick={() => void addShare()}>
            {saving ? FEEDBACK.loading : 'Share record'}
          </button>
        </div>
      ) : null}

      {shares.length === 0 ? <p className="muted">Not shared with anyone yet.</p> : null}
      {shares.map((share) => {
        const member = members.find((item) => item.user_id === share.shared_with_user_id);
        return (
          <div key={share.id} className="list-row compact">
            <div>
              <strong>{member ? memberLabel(member) : 'Team member'}</strong>
              <p className="muted">{share.access_level === 'edit' ? 'Can edit' : 'View only'}</p>
            </div>
            {canManage ? (
              <button className="btn" type="button" onClick={() => void removeShare(share.id)}>
                Remove
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
