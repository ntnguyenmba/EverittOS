'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeRole } from '@/lib/roles';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
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

type AccessRole = 'manager' | 'office' | 'customer_contact' | 'property_owner' | 'other';

const ACCESS_ROLE_OPTIONS: Array<{ value: AccessRole; label: string }> = [
  { value: 'manager', label: 'Manager' },
  { value: 'office', label: 'Office' },
  { value: 'customer_contact', label: 'Customer contact' },
  { value: 'property_owner', label: 'Property owner' },
  { value: 'other', label: 'Other' }
];

const copy = {
  en: { edit: 'Edit', viewOnly: 'View only' },
  es: { edit: 'Editar', viewOnly: 'Solo ver' },
  vi: { edit: 'Sửa', viewOnly: 'Chỉ xem' }
} as const;

function memberLabel(member: MemberOption): string {
  const name = member.profile?.full_name?.trim();
  const email = member.profile?.email?.trim();
  if (name && email) return `${name} (${email})`;
  return name || email || member.user_id;
}

export function RecordSharingPanel({ organizationId, recordType, recordId, canManage }: RecordSharingPanelProps) {
  const feedback = useAppFeedback();
  const { locale } = useTranslation();
  const c = copy[locale];
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [email, setEmail] = useState('');
  const [accessRole, setAccessRole] = useState<AccessRole>('office');
  const [accessLevel, setAccessLevel] = useState<'view' | 'edit'>('view');
  const [saving, setSaving] = useState(false);
  const isJobAdditionalAccess = recordType === 'job';

  const loadMembers = useCallback(async () => {
    if (!organizationId) return;
    const { data: memberRows, error } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'manager', 'employee', 'staff', 'crew_lead', 'viewer'])
      .order('role');

    if (error) {
      feedback.error(error.message || 'Unable to load people.');
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
  }, [feedback, organizationId]);

  const loadShares = useCallback(async () => {
    if (!recordId) return;
    const res = await fetch(`/api/record-shares?recordType=${recordType}&recordId=${recordId}`);
    const json = (await res.json().catch(() => ({}))) as { shares?: ShareRecord[]; error?: string };
    if (!res.ok) {
      feedback.error(json.error || 'Unable to load additional access.');
      return;
    }
    setShares(json.shares || []);
  }, [feedback, recordId, recordType]);

  useEffect(() => {
    void loadMembers();
    void loadShares();
  }, [loadMembers, loadShares]);

  async function addShare() {
    if (saving) return;
    setSaving(true);
    const res = await fetch('/api/record-shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordType,
        recordId,
        userIds: selectedUserId ? [selectedUserId] : undefined,
        email: email.trim() || undefined,
        accessLevel,
        accessRole: isJobAdditionalAccess ? accessRole : undefined
      })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to share access.');
      return;
    }
    setSelectedUserId('');
    setEmail('');
    feedback.success(FEEDBACK.updated);
    void loadShares();
  }

  async function removeShare(shareId: string) {
    if (!window.confirm('Remove this additional access?')) return;
    const res = await fetch(`/api/record-shares?id=${shareId}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      feedback.error(json.error || 'Unable to remove access.');
      return;
    }
    feedback.success(FEEDBACK.updated);
    void loadShares();
  }

  const shareLookup = new Map(shares.map((share) => [share.shared_with_user_id, share]));
  const availableMembers = members.filter((member) => {
    if (shareLookup.has(member.user_id)) return false;
    // Assigned contractors receive job access automatically — never share via this panel.
    if (recordType === 'job' && normalizeRole(member.role) === 'contractor') return false;
    return true;
  });

  return (
    <div className={isJobAdditionalAccess ? undefined : 'card'} style={isJobAdditionalAccess ? undefined : { marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>{isJobAdditionalAccess ? 'Additional access' : 'Record access'}</h3>
      <p className="muted">
        {isJobAdditionalAccess
          ? 'Share this job with managers, office staff, coordinators, customer contacts, property owners, realtors, assistants, or vendors who are not assigned contractors.'
          : 'Give another person view or edit access to this record.'}
      </p>

      {canManage ? (
        <div className="form">
          <label>Existing person</label>
          <select className="input" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="">Select person…</option>
            {availableMembers.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {memberLabel(member)} · {normalizeRole(member.role)}
              </option>
            ))}
          </select>
          <label>Or email</label>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            disabled={Boolean(selectedUserId)}
            onChange={(e) => setEmail(e.target.value)}
          />
          {isJobAdditionalAccess ? (
            <>
              <label>Role</label>
              <select
                className="input"
                value={accessRole}
                onChange={(e) => setAccessRole(e.target.value as AccessRole)}
              >
                {ACCESS_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <label>Permission</label>
          <select className="input" value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as 'view' | 'edit')}>
            <option value="view">{c.viewOnly}</option>
            <option value="edit">{c.edit}</option>
          </select>
          <button
            className="btn btn-primary"
            type="button"
            disabled={(!selectedUserId && !email.trim()) || saving}
            onClick={() => void addShare()}
          >
            {saving ? FEEDBACK.loading : 'Share'}
          </button>
        </div>
      ) : null}

      {shares.length === 0 ? <p className="muted">No additional access yet.</p> : null}
      {shares.map((share) => {
        const member = members.find((item) => item.user_id === share.shared_with_user_id);
        return (
          <div key={share.id} className="list-row compact">
            <div>
              <strong>{member ? memberLabel(member) : 'Person'}</strong>
              <p className="muted">{share.access_level === 'edit' ? c.edit : c.viewOnly}</p>
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
