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
} from '@/lib/contractor-compensation';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { getTeamPageCopy } from '@/lib/i18n/team-page-copy';
import { fetchWithTimeout, requestFailureMessage } from '@/lib/fetch-with-timeout';
import { canViewTeam, isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

type WorkerSummary = {
  openJobs: number;
  unpaid: number;
};

const EMPTY_CONTRACTOR = {
  name: '',
  email: '',
  phone: '',
  companyName: '',
  contractorClassification: 'contractor' as ContractorClassification
};

const PAGE_SIZE = 10;

function money(value: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
}

function ContractorPanel({ canManage }: { canManage: boolean }) {
  const { locale } = useTranslation();
  const c = getTeamPageCopy(locale);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [summaries, setSummaries] = useState<Record<string, WorkerSummary>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [form, setForm] = useState(EMPTY_CONTRACTOR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadContractors = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/contractors', { cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as { contractors?: Contractor[]; error?: string };

    if (!res.ok) {
      setLoading(false);
      setMessage(json.error || c.unableLoad);
      setContractors([]);
      setSummaries({});
      return;
    }

    const rows = (json.contractors || []).map((row) => ({
      ...row,
      contractor_classification: normalizeContractorClassification(row.contractor_classification)
    }));
    setContractors(rows);
    setVisibleCount(PAGE_SIZE);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    const org = user ? await fetchOrganizationContext(user.id) : null;
    if (!org?.organizationId || rows.length === 0) {
      setSummaries({});
      setLoading(false);
      return;
    }

    const contractorIds = rows.map((row) => row.id);
    const [{ data: jobs }, { data: labor }] = await Promise.all([
      supabase
        .from('jobs')
        .select('assigned_to, status')
        .eq('organization_id', org.organizationId)
        .in('assigned_to', contractorIds),
      supabase
        .from('job_labor')
        .select('worker_name, total_cost, payment_status')
        .eq('organization_id', org.organizationId)
    ]);

    const next: Record<string, WorkerSummary> = {};
    for (const contractor of rows) next[contractor.id] = { openJobs: 0, unpaid: 0 };

    for (const job of jobs || []) {
      const id = String(job.assigned_to || '');
      if (!next[id]) continue;
      const status = String(job.status || '').toLowerCase();
      if (!['completed', 'finished', 'cancelled', 'canceled'].includes(status)) next[id].openJobs += 1;
    }

    const byName = new Map(rows.map((row) => [row.name.trim().toLowerCase(), row.id]));
    for (const row of labor || []) {
      const status = String(row.payment_status || 'unpaid').toLowerCase();
      if (status === 'paid') continue;
      const id = byName.get(String(row.worker_name || '').trim().toLowerCase());
      if (!id || !next[id]) continue;
      next[id].unpaid += Number(row.total_cost || 0);
    }

    setSummaries(next);
    setLoading(false);
  }, [c.unableLoad]);

  useEffect(() => {
    void loadContractors();
  }, [loadContractors]);

  const visibleContractors = useMemo(() => contractors.slice(0, visibleCount), [contractors, visibleCount]);

  async function addContractor() {
    if (!canManage || saving) return;
    if (!form.name.trim()) {
      setMessage(c.enterName);
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await fetchWithTimeout('/api/contractors', {
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
      if (!res.ok) {
        setMessage(json.error || c.unableAdd);
        return;
      }

      setForm(EMPTY_CONTRACTOR);
      setMessage(c.memberAdded);
      await loadContractors();
    } catch (error) {
      setMessage(requestFailureMessage(error, c.unableAdd));
    } finally {
      setSaving(false);
    }
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
      setMessage(json.error || c.unableUpdate);
      return;
    }
    void loadContractors();
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h2>{c.recordsTitle}</h2>
      <p className="muted">{c.recordsIntro}</p>

      {canManage ? (
        <details className="card" style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{c.addRecord}</summary>
          <div className="form" style={{ marginTop: 16 }}>
            <div className="grid-2">
              <label>{c.name}<input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>{c.company}<input className="input" value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} placeholder={c.optional} /></label>
              <label>{c.phone}<input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder={c.optional} /></label>
              <label>{c.email}<input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder={c.optional} /></label>
              <label>
                {c.type}
                <select className="input" value={form.contractorClassification} onChange={(event) => setForm({ ...form, contractorClassification: normalizeContractorClassification(event.target.value) })}>
                  {contractorClassificationOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void addContractor()}>{saving ? c.adding : c.addRecordButton}</button>
          </div>
        </details>
      ) : null}

      {message ? <p className="muted">{message}</p> : null}
      {loading ? <p className="loading-state">{c.loading}</p> : null}
      {!loading && contractors.length === 0 ? <p className="muted">{canManage ? c.noRecordsManage : c.noRecords}</p> : null}

      {visibleContractors.length > 0 ? (
        <div className="team-member-list" data-native-pagination="true">
          {visibleContractors.map((contractor) => {
            const contact = contractor.phone || contractor.email;
            const summary = summaries[contractor.id] || { openJobs: 0, unpaid: 0 };
            return (
              <article key={contractor.id} className="list-row team-member-card open-in-new-tab-card">
                <Link href={`/jobs?assigned_to=${encodeURIComponent(contractor.id)}`} target="_blank" rel="noopener noreferrer" className="record-card-overlay-link" aria-label={`${c.viewJobs} ${contractor.name}`}><span className="record-card-overlay-label">{c.viewJobs} {contractor.name}</span></Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong><Link href={`/jobs?assigned_to=${encodeURIComponent(contractor.id)}`} target="_blank" rel="noopener noreferrer">{contractor.name}</Link></strong>
                  <p className="muted" style={{ margin: '3px 0 0', overflowWrap: 'anywhere' }}>{contractorClassificationLabel(contractor.contractor_classification)}{contractor.company_name ? ` · ${contractor.company_name}` : ''}</p>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
                    <span><strong>{summary.openJobs}</strong> <span className="muted">{c.openJobs}</span></span>
                    <span><strong>{money(summary.unpaid)}</strong> <span className="muted">{c.unpaid}</span></span>
                  </div>
                  {contact ? <p className="muted" style={{ margin: '8px 0 0', overflowWrap: 'anywhere' }}>{contact}</p> : null}
                </div>
                <div className="inline-actions" style={{ position: 'relative', zIndex: 2 }}>
                  <Link className="btn btn-sm" href={`/contractor-pay?status=unpaid`}>{c.pay}</Link>
                  {canManage ? <button type="button" className="btn btn-sm" onClick={() => void toggleContractor(contractor)}>{contractor.active === false ? c.activate : c.deactivate}</button> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {!loading && contractors.length > 0 ? (
        <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
          <p className="muted" style={{ margin: 0 }}>{c.showing} {Math.min(visibleCount, contractors.length)} / {contractors.length}</p>
          {visibleCount < contractors.length ? <button type="button" className="btn" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>{c.show10More}</button> : null}
        </div>
      ) : null}
    </section>
  );
}

export default function PeoplePage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const exportCopy = getExportCopy(locale);
  const teamCopy = getTeamPageCopy(locale);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
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

  if (loading) return <AppShell plan={plan} role={role}><p className="loading-state">{teamCopy.loading}</p></AppShell>;

  return (
    <AppShell plan={plan} role={role}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>{t('nav.team')}</h1>
          <p className="muted" style={{ margin: '8px 0 0' }}>{teamCopy.intro}</p>
        </div>
        {canViewTeam(role) ? <ExportMenu endpoint="/api/exports/team" locale={locale} onError={(message) => setExportError(message || exportCopy.exportFailed)} onSuccess={() => setExportError('')} /> : null}
      </div>
      {exportError ? <p className="auth-message auth-message-error">{exportError}</p> : null}
      <TeamDirectory />
      <TeamManagementPanel showPermissionMatrix={false} showAuditHistory={false} />
      <ContractorPanel canManage={isManagerRole(role)} />
    </AppShell>
  );
}
