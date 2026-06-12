'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { fetchOrganizationContext } from '@/lib/organization';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import {
  buildCustomerUpdatePayload,
  customerDisplayName,
  type CustomerRecord
} from '@/lib/customer-record';
import { supabase } from '@/lib/supabase';

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
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

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
      setMessage(error?.message || 'Customer not found');
      return;
    }

    setDisplayName(customerDisplayName(customer as CustomerRecord));
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    setAddress(customer.address || '');
    setNotes(customer.notes || '');

    const org = await fetchOrganizationContext(user.id);
    const orgId = org?.organizationId || customer.organization_id;

    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id, title, status')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    const jobIds = (jobRows || []).map((j) => j.id);
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
        (accessRows || []).map((row) => {
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

  async function saveCustomer() {
    if (!canEdit) return;
    const { error } = await supabase
      .from('customers')
      .update(
        buildCustomerUpdatePayload({
          displayName,
          phone,
          email,
          address,
          notes
        })
      )
      .eq('id', customerId);
    if (error) setMessage(error.message);
    else setMessage('Customer saved.');
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
        <div className="page-head">
          <h2>{displayName}</h2>
          <Link className="btn" href="/customers">
            Back
          </Link>
        </div>

        {message && <p className="card">{message}</p>}

        <div className="grid-2">
          <div className="card form">
            <h3>Edit customer</h3>
            <input className="input" value={displayName} disabled={!canEdit} onChange={(e) => setDisplayName(e.target.value)} />
            <input className="input" value={phone} disabled={!canEdit} onChange={(e) => setPhone(e.target.value)} />
            <input className="input" value={email} disabled={!canEdit} onChange={(e) => setEmail(e.target.value)} />
            <input className="input" value={address} disabled={!canEdit} onChange={(e) => setAddress(e.target.value)} />
            <textarea className="input" rows={4} value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} />
            {canEdit && (
              <button type="button" className="btn btn-primary" onClick={saveCustomer}>
                Save
              </button>
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
            <p className="muted">Client portal requires Operations plan or higher.</p>
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
