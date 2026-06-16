'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CustomerLogo } from '@/components/customer-logo';
import { fetchOrganizationContext } from '@/lib/organization';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { customerDisplayAddress, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { uploadCustomerLogo } from '@/lib/customer-logo';
import { supabase } from '@/lib/supabase';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { ensureOrganizationForUser } from '@/lib/workspace-client';

type PageProps = { params: Promise<{ id: string }> };

export default function CustomerDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [canEdit, setCanEdit] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
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
    setPlan(normalizePlan(profile?.plan));
    setCanEdit(isManagerRole(normalizeRole(profile?.role)));

    const { data: customer, error } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (error || !customer) {
      setLoading(false);
      appFeedback.error(error?.message || 'Customer not found');
      return;
    }

    setDisplayName(customerDisplayName(customer as CustomerRecord));
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    setAddress(customerDisplayAddress(customer as CustomerRecord, ''));
    setNotes(customer.notes || '');
    setLogoPath((customer as CustomerRecord).logo_path || null);

    const org = await fetchOrganizationContext(user.id);
    const orgId = org?.organizationId || customer.organization_id;

    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id, title, status')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    const jobIds = (jobRows || []).map((j: { id: string }) => j.id);
    const [{ data: props }, { data: reportRows }] = await Promise.all([
      orgId
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
      appFeedback.error('Workspace is not ready yet. Refresh and try again.');
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
      body: JSON.stringify({ displayName, phone, email, address, notes })
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

  async function addProperty() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user || !propName.trim()) return;
    const org = await fetchOrganizationContext(user.id);
    if (!org) return;
    await supabase.from('customer_properties').insert({
      customer_id: customerId,
      organization_id: org.organizationId,
      user_id: user.id,
      name: propName.trim(),
      address: propAddress.trim() || null
    });
    setPropName('');
    setPropAddress('');
    load();
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
          <h2>{displayName}</h2>
          <Link className="btn" href="/customers">
            Back
          </Link>
        </div>


        <div className="grid-2">
          <div className="card form">
            <h3>Edit customer</h3>
            <input className="input" value={displayName} disabled={!canEdit} onChange={(e) => setDisplayName(e.target.value)} />
            <input className="input" value={phone} disabled={!canEdit} onChange={(e) => setPhone(e.target.value)} />
            <input className="input" value={email} disabled={!canEdit} onChange={(e) => setEmail(e.target.value)} />
            <input className="input" value={address} disabled={!canEdit} onChange={(e) => setAddress(e.target.value)} />
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
                {logoUploading ? <p className="loading-state" role="status">Uploading logo…</p> : null}
                <button type="button" className="btn btn-primary" disabled={savingCustomer} onClick={() => void saveCustomer()}>
                  {savingCustomer ? FEEDBACK.loading : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ marginLeft: 8 }}
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
