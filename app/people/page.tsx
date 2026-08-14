'use client';

import { AppShell } from '@/components/app-shell';
import { ExportMenu } from '@/components/export-menu';
import { TeamDirectory } from '@/components/team/team-directory';
import { TeamManagementPanel } from '@/components/team/team-management-panel';
import { useTranslation } from '@/components/locale-provider';
import {
  contractorClassificationLabel,
  contractorClassificationOptions,
  normalizeContractorClassification,
  type ContractorClassification
} from '@/lib/worker-compensation';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { canViewTeam, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
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
  contractorClassification: 'worker' as ContractorClassification
};

function ContractorPanel({ canManage }: { canManage: boolean }) {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [form, setForm] = useState(EMPTY_CONTRACTOR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadContractors = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/workers', { cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as {
      contractors?: Contractor[];
      error?: string;
    };
    setLoading(false);

    if (!res.ok) {
      setMessage(json.error || 'Unable to load team members.');
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
      setMessage('Enter a name.');
      return;
    }

    setSaving(true);
    setMessage('');

    const res = await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        companyName: form.companyName.trim() || null,
        contractorClassification: form.contractorClassification
      })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };

    setSaving(false);
    if (!res.ok) {
      setMessage(json.error || 'Unable to add team member.');
      return;
    }

    setForm(EMPTY_CONTRACTOR);
    setMessage('Team member added.');
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
      setMessage(json.error || 'Unable to update team member.');
      return;
    }
    void loadContractors();
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Contractors and staff records</h2>
      <p className="muted">Add people who need job assignments or payment records but do not need workspace access.</p>

      {canManage ? (
        <details className="card" style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Add team record</summary>
          <div className="form" style={{ marginTop: 16 }}>
            <div className="grid-2">
              <label>
                Name
                <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label>
                Company
                <input className="input" value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} placeholder="Optional" />
              </label>
              <label>
                Phone
                <input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Optional" />
              </label>
              <label>
                Email
                <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Optional" />
              </label>
              <label>
                Type
                <select
                  className="input"
                  value={form.contractorClassification}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      contractorClassification: normalizeContractorClassification(event.target.value)
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
            </div>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void addContractor()}>
              {saving ? 'Adding...' : 'Add record'}
            </button>
          </div>
        </details>
      ) : null}

      {message ? <p className="muted">{message}</p> : null}
      {loading ? <p className="loading-state">Loading...</p> : null}
      {!loading && contractors.length === 0 ? (
        <p className="muted">
          {canManage ? 'No team records yet.' : 'No team records have been added.'}
        </p>
      ) : null}

      {contractors.length > 0 ? (
        <div className="team-member-list">
          {contractors.map((contractor) => {
            const contact = contractor.phone || contractor.email;
            return (
              <article key={contractor.id} className="list-row team-member-card">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{contractor.name}</strong>
                  <p className="muted" style={{ margin: '3px 0 0', overflowWrap: 'anywhere' }}>
                    {contractorClassificationLabel(contractor.contractor_classification)}
                    {contractor.company_name ? ` · ${contractor.company_name}` : ''}
                  </p>
                  {contact ? (
                    <p className="muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>
                      {contact}
                    </p>
                  ) : null}
                </div>
                {canManage ? (
                  <button type="button" className="btn btn-sm" onClick={() => void toggleContractor(contractor)}>
                    {contractor.active === false ? 'Activate' : 'Deactivate'}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default function PeoplePage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const exportCopy = getExportCopy(locale);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);
  const [exportError, setExportError] = useState('');

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
        <p className="loading-state">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell plan={plan} role={role}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>{t('nav.team')}</h1>
          <p className="muted" style={{ margin: '8px 0 0' }}>Find team members, manage access, and assign work.</p>
        </div>
        {canViewTeam(role) ? (
          <ExportMenu
            endpoint="/api/exports/team"
            locale={locale}
            onError={(message) => setExportError(message || exportCopy.exportFailed)}
            onSuccess={(format) => {
              setExportError('');
              if (format === 'share') setExportError('');
            }}
          />
        ) : null}
      </div>
      {exportError ? <p className="auth-message auth-message-error">{exportError}</p> : null}
      <TeamDirectory />
      <TeamManagementPanel showPermissionMatrix={false} showAuditHistory={false} />
      <ContractorPanel canManage={isManagerRole(role)} />
    </AppShell>
  );
}
