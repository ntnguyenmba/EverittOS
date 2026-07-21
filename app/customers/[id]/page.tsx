'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ContactLink } from '@/components/contact-link';
import { CustomerLogo } from '@/components/customer-logo';
import { RecordSharingPanel } from '@/components/record-sharing-panel';
import { fetchOrganizationContext } from '@/lib/organization';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { customerDisplayAddress, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { uploadCustomerLogo } from '@/lib/customer-logo';
import { useTeamOptions } from '@/lib/team-options-client';
import { supabase } from '@/lib/supabase';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { canAccessWorkspaceRecord } from '@/lib/workspace-record-access';
import { ensureOrganizationForUser } from '@/lib/workspace-client';

type PageProps = { params: Promise<{ id: string }> };

const CUSTOMER_STAGES = [
  { value: 'active', label: 'Active' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'former', label: 'Former customer' }
];

export default function CustomerDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { teamOptions, teamOptionsLoading } = useTeamOptions();
  const [customerId, setCustomerId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [canEdit, setCanEdit] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [pipelineStage, setPipelineStage] = useState('active');
  const [properties, setProperties] = useState<{ id: string; name: string; address: string | null }[]>([]);
  const [jobs, setJobs] = useState<{ id: string; title: string; status: string | null }[]>([]);
  const [reports, setReports] = useState<{ id: string; title: string; job_id: string }[]>([]);
  const [portalAccess, setPortalAccess] = useState<
    { job_id: string; client_user_id: string; portal_token: string | null; profiles?: { email: string | null } | null }[]
  >([]);
  const [propName, setPropName] = useState('');
  const [propAddress, setPropAddress] = useState('');
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [movingToLead, setMovingToLead] = useState(false);
  const [loading, setLoading] = useState(true);
  const appFeedback = useAppFeedback();

  useEffect(() => {
    params.then((p) => setCustomerId(p.id));
  }, [params]);

  async function load() {
    if (!customerId) return;
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    const workspaceRole = normalizeRole(org?.role || profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setCanEdit(isManagerRole(workspaceRole));

    const { data: customer, error } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (error || !customer) {
      setLoading(false);
      appFeedback.error(error?.message || t('pages.customers.notFound'));
      return;
    }

    if (!canAccessWorkspaceRecord(customer, user.id, org?.organizationId, workspaceRole)) {
      setLoading(false);
      appFeedback.error(t('pages.customers.notFound'));
      return;
    }

    const customerRecord = customer as CustomerRecord;
    setDisplayName(customerDisplayName(customerRecord));
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    setAddress(customerDisplayAddress(customerRecord, ''));
    setNotes(customer.notes || '');
    setAssignedTo(customerRecord.assigned_to || '');
    setPipelineStage(customerRecord.pipeline_stage || 'active');
    setLogoPath(customerRecord.logo_path || null);

    const resolvedOrgId = org?.organizationId || customer.organization_id || '';
    setOrgId(resolvedOrgId);

    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id, title, status')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    const jobIds = (jobRows || []).map((j: { id: string }) => j.id);
    const [{ data: props }, { data: reportRows }] = await Promise.all([
      resolvedOrgId
        ? supabase.from('customer_properties').select('id, name, address').eq('customer_id', customerId)
        : Promise.resolve({ data: [] }),
      jobIds.length
        ? supabase.from('job_reports').select('id, title, job_id').in('job_id', jobIds)
        : Promise.resolve({ data: [] })
    ]);

    setProperties(props || []);
    setJobs(jobRows || []);
    setReports(reportRows || []);

    if (jobIds.length) {
      const { data: accessRows } = await supabase
        .from('job_client_access')
        .select('job_id, client_user_id, portal_token, profiles:profiles(email)')
        .in('job_id', jobIds);
      setPortalAccess(
        (accessRows || []).map((row: {
          job_id: string;
          client_user_id: string;
          portal_token: string | null;
          profiles: { email: string | null } | { email: string | null }[] | null;
        }) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return {
            job_id: row.job_id as string,
            client_user_id: row.client_user_id as string,
            portal_token: (row.portal_token as string | null) || null,
            profiles: profile ? { email: (profile as { email: string | null }).email } : null
          };
        })
      );
    } else {
      setPortalAccess([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [customerId]);

  async function uploadLogo(file: File | null) {
    if (!file || !canEdit || !customerId) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const org = await ensureOrganizationForUser(user.id);
    if (!org?.organizationId) {
      appFeedback.error('Your account is still setting up. Refresh and try again.');
      return;
    }

    setLogoUploading(true);
    const { path, error } = await uploadCustomerLogo(supabase, org.organizationId, customerId, file);
    if (error || !path) {
      setLogoUploading(false);
      appFeedback.error(error || 'Logo upload failed.');
      return;
    }

    const logoRes = await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_path: path })
    });
    const logoJson = (await logoRes.json().catch(() => ({}))) as { error?: string };
    setLogoUploading(false);
    if (!logoRes.ok) {
      appFeedback.error(logoJson.error || 'Logo could not be saved.');
      return;
    }
    setLogoPath(path);
    appFeedback.uploadComplete();
  }

  async function saveCustomer() {
    if (!canEdit || !customerId || savingCustomer) return;
    setSavingCustomer(true);
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        phone,
        email,
        address,
        notes,
        assigned_to: assignedTo || null,
        pipeline_stage: pipelineStage,
        record_type: 'customer'
      })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSavingCustomer(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to save customer.');
      return;
    }
    appFeedback.saved();
    load();
  }

  async function moveBackToLead() {
    if (!canEdit || !customerId || movingToLead) return;
    if (!window.confirm('Move this customer back to Leads?')) return;
    setMovingToLead(true);
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_type: 'lead', pipeline_stage: 'reopened' })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setMovingToLead(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to move customer back to leads.');
      return;
    }
    appFeedback.saved();
    router.push(`/leads/${customerId}`);
  }

  async function addProperty() {
    if (!propName.trim()) return;
    const res = await fetch(`/api/customers/${customerId}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: propName.trim(), address: propAddress.trim() || null })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to create property.');
      return;
    }
    setPropName('');
    setPropAddress('');
    appFeedback.success('Property created.');
    void load();
  }

  if (loading) {
    return (
      <AppShell plan={plan}>
        <div className="card">Loading customer...</div>
      </AppShell>
    );
  }

  return (
    <AppShell plan={plan}>
        <div className="page-head customer-card-row">
          <CustomerLogo logoPath={logoPath} alt={displayName} size={56} />
          <div>
            <h2>{displayName}</h2>
            <p className="muted">{CUSTOMER_STAGES.find((stage) => stage.value === pipelineStage)?.label || pipelineStage}</p>
          </div>
          <Link className="btn" href="/customers">
            Back
          </Link>
        </div>

        <div className="grid-2">
          <div className="card form">
            <h3>Edit customer</h3>
            <label>Name</label>
            <input className="input" value={displayName} disabled={!canEdit} onChange={(e) => setDisplayName(e.target.value)} />
            <label htmlFor="customer-phone">Phone</label>
            {canEdit ? (
              <input
                id="customer-phone"
                className="input"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            ) : (
              <p>
                <ContactLink type="phone" value={phone} />
              </p>
            )}
            <label htmlFor="customer-email">Email</label>
            {canEdit ? (
              <input
                id="customer-email"
                className="input"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            ) : (
              <p>
                <ContactLink type="email" value={email} />
              </p>
            )}
            <label htmlFor="customer-address">Address</label>
            <input
              id="customer-address"
              className="input"
              autoComplete="street-address"
              value={address}
              disabled={!canEdit}
              onChange={(e) => setAddress(e.target.value)}
            />
            <label>Assign to</label>
            <select className="input" value={assignedTo} disabled={!canEdit || teamOptionsLoading} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Unassigned</option>
              {teamOptions.map((member) => (
                <option key={member.userId} value={member.userId}>{member.label} - {member.role}</option>
              ))}
            </select>
            <label>Status</label>
            <select className="input" value={pipelineStage} disabled={!canEdit} onChange={(e) => setPipelineStage(e.target.value)}>
              {CUSTOMER_STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>{stage.label}</option>
              ))}
            </select>
            <label>Notes</label>
            <textarea className="input" rows={4} value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} />
            {canEdit && (
              <>
                <label className="auth-field">
                  <span>Logo</span>
                  <input
                    className="input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={logoUploading}
                    onChange={(e) => void uploadLogo(e.target.files?.[0] || null)}
                  />
                </label>
                {logoUploading ? <p className="loading-state" role="status">Uploading logo...</p> : null}
                <div className="inline-actions">
                  <button type="button" className="btn btn-primary" disabled={savingCustomer} onClick={() => void saveCustomer()}>
                    {savingCustomer ? FEEDBACK.loading : 'Save'}
                  </button>
                  <button type="button" className="btn" disabled={movingToLead} onClick={() => void moveBackToLead()}>
                    {movingToLead ? FEEDBACK.loading : 'Move back to lead'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={async () => {
                      if (!window.confirm('Remove this customer?')) return;
                      const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
                      const json = (await res.json().catch(() => ({}))) as { error?: string };
                      if (!res.ok) {
                        appFeedback.error(json.error || 'Unable to remove customer.');
                        return;
                      }
                      appFeedback.deleted();
                      router.push('/customers');
                    }}
                  >
                    Remove customer
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="card form">
            <h3>Properties</h3>
            {properties.length === 0 && <p>No properties yet.</p>}
            {properties.map((p) => (
              <p key={p.id}>
                <strong>{p.name}</strong> · {p.address || 'No address'}
              </p>
            ))}
            {canEdit && (
              <>
                <input className="input" placeholder="Property name" value={propName} onChange={(e) => setPropName(e.target.value)} />
                <input className="input" placeholder="Address" value={propAddress} onChange={(e) => setPropAddress(e.target.value)} />
                <button type="button" className="btn" onClick={addProperty}>
                  Add property
                </button>
              </>
            )}
          </div>
        </div>

        {orgId ? <RecordSharingPanel organizationId={orgId} recordType="customer" recordId={customerId} canManage={canEdit} /> : null}

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Linked jobs</h3>
          {jobs.length === 0 && <p>No jobs linked.</p>}
          {jobs.map((j) => (
            <div key={j.id} className="list-row">
              <Link href={`/jobs/${j.id}`}>{j.title}</Link>
              <span>{j.status}</span>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Client portal access</h3>
          {!limitsForPlan(plan).clientPortal ? (
            <p className="muted">Client portal requires Growth plan or higher.</p>
          ) : portalAccess.length === 0 ? (
            <p className="muted">No client portal access granted for this customer&apos;s jobs yet. Grant access from a job detail page.</p>
          ) : (
            portalAccess.map((row) => (
              <div key={`${row.job_id}-${row.client_user_id}`} className="list-row">
                <div>
                  <strong>{row.profiles?.email || row.client_user_id}</strong>
                  <p className="muted">Job: {jobs.find((j) => j.id === row.job_id)?.title || row.job_id}</p>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      await fetch('/api/clients/revoke-access', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jobId: row.job_id, clientUserId: row.client_user_id })
                      });
                      load();
                    }}
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Linked reports</h3>
          {reports.length === 0 && <p>No reports yet.</p>}
          {reports.map((r) => (
            <div key={r.id} className="list-row">
              <Link href={`/jobs/${r.job_id}/report`}>{r.title}</Link>
            </div>
          ))}
        </div>
    </AppShell>
  );
}
