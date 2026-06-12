'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { errorFeedback, successFeedback, type ActionFeedback } from '@/lib/action-messages';
import { CUSTOMER_LIST_SELECT, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type LeadMetrics = {
  newLeads30d: number;
  openLeads: number;
  conversionRate: number;
  formSubmissions30d: number;
  proposalsSent30d: number;
  proposalsAccepted30d: number;
  bySource: Record<string, number>;
};

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  referral: 'Referral',
  facebook: 'Facebook',
  google: 'Google',
  instagram: 'Instagram',
  manual: 'Manual entry',
  form: 'Form',
  other: 'Other'
};

export default function LeadsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [metrics, setMetrics] = useState<LeadMetrics | null>(null);
  const [leads, setLeads] = useState<CustomerRecord[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadSource, setLeadSource] = useState('manual');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [canManage, setCanManage] = useState(false);

  async function load() {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const userRole = normalizeRole(profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(userRole);
    setCanManage(isManagerRole(userRole));

    const org = await ensureOrganizationForUser(user.id);
    let leadsQuery = supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .in('pipeline_stage', ['lead', 'qualified'])
      .order('created_at', { ascending: false });
    if (org?.organizationId) {
      leadsQuery = leadsQuery.eq('organization_id', org.organizationId);
    } else {
      leadsQuery = leadsQuery.eq('user_id', user.id);
    }

    const [metricsRes, leadsRes] = await Promise.all([
      fetch('/api/leads/metrics'),
      leadsQuery
    ]);

    const metricsJson = await metricsRes.json();
    setLoading(false);
    if (!metricsRes.ok) {
      setFeedback(errorFeedback(metricsJson.error || 'Unable to load metrics'));
    } else {
      setMetrics(metricsJson.metrics);
    }
    if (leadsRes.error) {
      setFeedback(errorFeedback(leadsRes.error.message));
    } else {
      setLeads((leadsRes.data || []) as CustomerRecord[]);
    }
  }

  useEffect(() => {
    void load();
  }, [router]);

  async function addLead() {
    if (!displayName.trim() || saving) return;
    setSaving(true);
    setFeedback(null);
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        email,
        phone,
        pipeline_stage: 'lead',
        lead_source: leadSource,
        record_type: 'lead'
      })
    });
    const json = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Unable to save lead.'));
      return;
    }
    setDisplayName('');
    setEmail('');
    setPhone('');
    setFeedback(successFeedback('Lead saved.'));
    void load();
  }

  async function removeLead(id: string, name: string) {
    if (!window.confirm(`Remove lead ${name}?`)) return;
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Unable to remove lead.'));
      return;
    }
    setFeedback(successFeedback('Lead removed.'));
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>Lead Generation</h1>
        <p className="page-subtitle">Track new leads, conversion, sources, and form performance for this workspace.</p>
      </header>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {canManage ? (
        <div className="card form" style={{ marginBottom: 18 }}>
          <h3>Add lead</h3>
          <input className="input" placeholder="Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <select className="input" value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void addLead()}>
            {saving ? 'Saving…' : 'Save lead'}
          </button>
        </div>
      ) : null}

      {loading ? <p>Loading metrics…</p> : null}

      {metrics ? (
        <>
          <div className="dashboard-stats-grid">
            <div className="card stat-card metric-stack">
              <strong className="stat-value">{metrics.newLeads30d}</strong>
              <span className="stat-label">New leads (30d)</span>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Open pipeline</span>
              <strong className="stat-value">{metrics.openLeads}</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Conversion rate</span>
              <strong className="stat-value">{metrics.conversionRate}%</strong>
            </div>
            <div className="card stat-card">
              <span className="stat-label">Form submissions (30d)</span>
              <strong className="stat-value">{metrics.formSubmissions30d}</strong>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3>Open leads</h3>
            {leads.length === 0 ? (
              <p className="muted">No open leads yet. Add one above or capture leads from Forms.</p>
            ) : (
              leads.map((lead) => (
                <div key={lead.id} className="dashboard-today-row">
                  <Link href={`/customers/${lead.id}`}>{customerDisplayName(lead)}</Link>
                  <span className="muted">
                    {SOURCE_LABELS[lead.lead_source || ''] || lead.lead_source || 'manual'}
                    {canManage ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        style={{ marginLeft: 8 }}
                        onClick={() => void removeLead(lead.id, customerDisplayName(lead))}
                      >
                        Remove
                      </button>
                    ) : null}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3>Lead sources</h3>
            {Object.keys(metrics.bySource).length === 0 ? (
              <p className="muted">No lead source data yet. Sources are set on CRM records and form submissions.</p>
            ) : (
              <ul>
                {Object.entries(metrics.bySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => (
                    <li key={source} className="dashboard-today-row">
                      <span>{SOURCE_LABELS[source] || source}</span>
                      <span className="muted">{count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
