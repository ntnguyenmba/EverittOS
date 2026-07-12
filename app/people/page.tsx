'use client';

import { AppShell } from '@/components/app-shell';
import { TeamManagementPanel } from '@/components/team/team-management-panel';
import { useTranslation } from '@/components/locale-provider';
import {
  contractorClassificationOptions,
  formatContractorCompensationLabel,
  normalizeContractorClassification,
  parseHourlyRateInput,
  type ContractorClassification
} from '@/lib/contractor-compensation';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type Contractor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  hourly_rate: number | null;
  contractor_classification: ContractorClassification | null;
  active: boolean | null;
};

const EMPTY_CONTRACTOR = {
  name: '',
  email: '',
  phone: '',
  companyName: '',
  hourlyRate: '',
  contractorClassification: 'contractor' as ContractorClassification
};

function ContractorPanel({ canManage }: { canManage: boolean }) {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [form, setForm] = useState(EMPTY_CONTRACTOR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [rateError, setRateError] = useState('');

  const loadContractors = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/contractors', { cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as {
      contractors?: Contractor[];
      error?: string;
    };
    setLoading(false);

    if (!res.ok) {
      setMessage(json.error || 'Unable to load contractors.');
      setContractors([]);
      return;
    }

    setContractors(
      (json.contractors || []).map((row) => ({
        ...row,
        contractor_classification: normalizeContractorClassification(row.contractor_classification)
      }))
    );
  }, []);

  useEffect(() => {
    void loadContractors();
  }, [loadContractors]);

  async function addContractor() {
    if (!canManage || saving) return;
    if (!form.name.trim()) {
      setMessage('Add a contractor name first.');
      return;
    }

    const parsedRate = parseHourlyRateInput(form.hourlyRate);
    if (!parsedRate.ok) {
      setRateError(parsedRate.error);
      return;
    }

    setSaving(true);
    setMessage('');
    setRateError('');

    const res = await fetch('/api/contractors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        companyName: form.companyName.trim() || null,
        hourlyRate: form.hourlyRate,
        contractorClassification: form.contractorClassification
      })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };

    setSaving(false);
    if (!res.ok) {
      setMessage(json.error || 'Unable to add contractor.');
      return;
    }

    setForm(EMPTY_CONTRACTOR);
    setMessage('Contractor added.');
    void loadContractors();
  }

  async function toggleContractor(contractor: Contractor) {
    if (!canManage) return;
    const res = await fetch(`/api/contractors/${contractor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: contractor.active === false })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setMessage(json.error || 'Unable to update contractor.');
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
              Contractor type
              <select
                className="input"
                value={form.contractorClassification}
                onChange={(e) =>
                  setForm({
                    ...form,
                    contractorClassification: normalizeContractorClassification(e.target.value)
                  })
                }
              >
                {contractorClassificationOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hourly compensation
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.hourlyRate}
                onChange={(e) => {
                  setForm({ ...form, hourlyRate: e.target.value });
                  if (rateError) setRateError('');
                }}
                placeholder="Optional"
              />
            </label>
          </div>
          {rateError ? (
            <p className="auth-message auth-message-error" role="alert">
              {rateError}
            </p>
          ) : null}
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
                <p className="muted" style={{ margin: 0 }}>
                  {formatContractorCompensationLabel({
                    classification: contractor.contractor_classification,
                    hourlyRate: contractor.hourly_rate
                  })}
                </p>
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

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/people');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const org = await fetchOrganizationContext(user.id);
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(org?.role || profile?.role));
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
      <ContractorPanel canManage={isManagerRole(role)} />
    </AppShell>
  );
}
