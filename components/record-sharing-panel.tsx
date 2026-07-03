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
  profiles?: {
    email?: string | null;
    full_name?: string | null;
  } | null;
};

type ShareRecord = {
  id: string;
  shared_with_user_id: string;
  access_level: string;
  created_at: string | null;
};

function memberLabel(member: MemberOption): string {
  return member.profiles?.full_name || member.profiles?.email || 'Pending profile';
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
    const { data } = await supabase
      .from('organization_members')
      .select('user_id, role, profiles(email, full_name)')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .in('role', ['manager', 'employee', 'contractor', 'staff', 'crew_lead', 'viewer']);

    setMembers((data || []) as MemberOption[]);
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
              <strong>{member ? memberLabel(member) : 'Pending profile'}</strong>
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
