'use client';

import { AppShell } from '@/components/app-shell';
import { TeamManagementPanel } from '@/components/team/team-management-panel';
import { useTranslation } from '@/components/locale-provider';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Contractor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  hourly_rate: number | null;
  active: boolean | null;
};

const EMPTY_CONTRACTOR = {
  name: '',
  email: '',
  phone: '',
  companyName: '',
  hourlyRate: ''
};

function ContractorPanel({ userId, organizationId, canManage }: { userId: string; organizationId: string | null; canManage: boolean }) {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [form, setForm] = useState(EMPTY_CONTRACTOR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function loadContractors() {
    setLoading(true);
    let query = supabase
      .from('workers')
      .select('id, name, email, phone, company_name, hourly_rate, active')
      .eq('worker_type', 'contractor')
      .order('name');
    if (organizationId) query = query.eq('organization_id', organizationId);
    else query = query.eq('user_id', userId);
    const { data } = await query;
    setContractors((data || []) as Contractor[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadContractors();
  }, [userId, organizationId]);

  async function addContractor() {
    if (!canManage || saving) return;
    if (!form.name.trim()) {
      setMessage('Add a contractor name first.');
      return;
    }
    setSaving(true);
    setMessage('');
    const { error } = await supabase.from('workers').insert({
      user_id: userId,
      organization_id: organizationId,
      worker_type: 'contractor',
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company_name: form.companyName.trim() || null,
      hourly_rate: form.hourlyRate ? Number(form.hourlyRate) : null,
      active: true
    });
    setSaving(false);
    if (error) {
      setMessage(error.message || 'Unable to add contractor.');
      return;
    }
    setForm(EMPTY_CONTRACTOR);
    setMessage('Contractor added.');
    void loadContractors();
  }

  async function toggleContractor(contractor: Contractor) {
    if (!canManage) return;
    const { error } = await supabase.from('workers').update({ active: !contractor.active }).eq('id', contractor.id);
    if (error) {
      setMessage(error.message || 'Unable to update contractor.');
      return;
    }
    void loadContractors();
  }

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="page-header" style={{ paddingBottom: 0 }}>
        <div>
          <h2>Contractors</h2>
          <p className="muted">Add outside cleaners, helpers, installers, or subcontractors without creating EverittOS accounts.</p>
        </div>
      </div>

      {canManage ? (
        <div className="form" style={{ marginTop: 14 }}>
          <div className="grid-2">
            <label>
              Name
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contractor name" />
            </label>
            <label>
              Company
              <input className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Optional" />
            </label>
            <label>
              Phone
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
            </label>
            <label>
              Email
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Optional" />
            </label>
            <label>
              Hourly rate
              <input className="input" type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} placeholder="Optional" />
            </label>
          </div>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void addContractor()}>
            {saving ? 'Adding...' : 'Add contractor'}
          </button>
        </div>
      ) : null}

      {message ? <p className="muted" style={{ marginTop: 12 }}>{message}</p> : null}
      {loading ? <p className="loading-state">Loading contractors...</p> : null}
      {!loading && contractors.length === 0 ? <p className="muted">No contractors added yet.</p> : null}
      {contractors.length > 0 ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {contractors.map((contractor) => (
            <div key={contractor.id} className="list-row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>{contractor.name}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {[contractor.company_name, contractor.phone, contractor.email].filter(Boolean).join(' · ') || 'No contact details'}
                </p>
                {contractor.hourly_rate != null ? <p className="muted" style={{ margin: 0 }}>${Number(contractor.hourly_rate).toFixed(2)}/hr</p> : null}
              </div>
              <span className={`status-pill status-${contractor.active === false ? 'cancelled' : 'completed'}`}>{contractor.active === false ? 'Inactive' : 'Active'}</span>
              {canManage ? (
                <button type="button" className="btn btn-sm" onClick={() => void toggleContractor(contractor)}>
                  {contractor.active === false ? 'Reactivate' : 'Deactivate'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PeoplePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/people');
        return;
      }
      setUserId(user.id);
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const org = await fetchOrganizationContext(user.id);
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(org?.role || profile?.role));
      setOrganizationId(org?.organizationId || null);
      setLoading(false);
    }
    void load();
  }, [router]);

  if (loading) {
    return (
      <AppShell plan={plan} role={role}>
        <p className="loading-state">Loading people...</p>
      </AppShell>
    );
  }

  return (
    <AppShell plan={plan} role={role}>
      <h1>{t('nav.team')}</h1>
      <p className="muted">Invite people, manage roles, and control access. Add contractors below when they do not need an EverittOS login.</p>
      <TeamManagementPanel showPermissionMatrix showAuditHistory={false} />
      {userId ? <ContractorPanel userId={userId} organizationId={organizationId} canManage={isManagerRole(role)} /> : null}
    </AppShell>
  );
}
