'use client';

import Link from 'next/link';
import { GoToDashboardLink } from '@/components/go-to-dashboard-link';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PhotoGallery } from '@/components/photo-gallery';
import { normalizePlan } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import { isClientRole, normalizeRole } from '@/lib/roles';
import { CUSTOMER_SEARCH_SELECT, customerDisplayName } from '@/lib/customer-record';
import { supabase } from '@/lib/supabase';

type ClientJob = {
  id: string;
  title: string;
  status: string | null;
  customer_notes: string | null;
  due_date: string | null;
  customer_id: string | null;
};

type ClientProfile = {
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
};

type ClientInvoice = {
  id: string;
  job_id: string | null;
  amount: number | null;
  status: string | null;
  due_date: string | null;
  created_at: string | null;
};

type TimelineRow = {
  id: string;
  job_id: string;
  message: string | null;
  event_type: string;
  created_at: string;
};

type CustomerRow = {
  id: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
};

type PortalTab = 'dashboard' | 'jobs' | 'invoices' | 'profile';

export default function ClientPortalPage() {
  return (
    <Suspense fallback={<main className="section"><div className="container"><div className="card">Loading portal...</div></div></main>}>
      <ClientPortalContent />
    </Suspense>
  );
}

function ClientPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portalToken = searchParams.get('token');
  const [tab, setTab] = useState<PortalTab>('dashboard');
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [reports, setReports] = useState<{ id: string; title: string; job_id: string }[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [photoAccessByJob, setPhotoAccessByJob] = useState<Record<string, boolean>>({});

  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=${encodeURIComponent('/portal/client' + (portalToken ? `?token=${portalToken}` : ''))}`);
        return;
      }

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('role, plan, email, full_name, business_name, phone')
        .eq('id', user.id)
        .maybeSingle();
      const role = normalizeRole(profileRow?.role);
      const plan = normalizePlan(profileRow?.plan);

      setProfile({
        email: profileRow?.email || user.email || null,
        full_name: profileRow?.full_name || null,
        business_name: profileRow?.business_name || null,
        phone: profileRow?.phone || null
      });

      if (!isClientRole(role) && !limitsForPlan(plan).clientPortal) {
        setMessage('Client portal requires Operations plan or higher, or a client role.');
        setLoading(false);
        return;
      }

      const { data: access } = portalToken
        ? await supabase
            .from('job_client_access')
            .select('job_id, client_user_id, can_view_photos')
            .eq('portal_token', portalToken)
        : await supabase
            .from('job_client_access')
            .select('job_id, client_user_id, can_view_photos')
            .eq('client_user_id', user.id);

      if (portalToken && access?.[0]?.client_user_id && access[0].client_user_id !== user.id) {
        setMessage('This portal link belongs to a different client account.');
        setLoading(false);
        return;
      }

      const accessMap: Record<string, boolean> = {};
      (access || []).forEach((row) => {
        accessMap[row.job_id as string] = row.can_view_photos !== false;
      });
      setPhotoAccessByJob(accessMap);

      const jobIds = (access || []).map((a) => a.job_id);
      if (jobIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: jobRows } = await supabase
        .from('jobs')
        .select('id, title, status, customer_notes, due_date, customer_id')
        .in('id', jobIds)
        .order('created_at', { ascending: false });

      const typedJobs = (jobRows || []) as ClientJob[];
      setJobs(typedJobs);

      const customerIds = Array.from(
        new Set(typedJobs.map((j) => j.customer_id).filter((id): id is string => Boolean(id)))
      );
      if (customerIds.length) {
        const { data: customerRows } = await supabase
          .from('customers')
          .select(CUSTOMER_SEARCH_SELECT)
          .in('id', customerIds);
        setCustomers((customerRows || []) as CustomerRow[]);
      }

      const [{ data: reportRows }, { data: timelineRows }] = await Promise.all([
        supabase.from('job_reports').select('id, title, job_id').in('job_id', jobIds),
        supabase
          .from('job_timeline')
          .select('id, job_id, message, event_type, created_at')
          .in('job_id', jobIds)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      setReports(reportRows || []);
      setTimeline((timelineRows || []) as TimelineRow[]);

      const { data: invoiceRows, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, job_id, amount, status, due_date, created_at')
        .or(`client_user_id.eq.${user.id},job_id.in.(${jobIds.join(',')})`)
        .order('created_at', { ascending: false });

      if (!invoiceError && invoiceRows) {
        setInvoices(invoiceRows as ClientInvoice[]);
      }

      setLoading(false);
    }
    load();
  }, [router, portalToken]);

  if (loading) {
    return (
      <AuthenticatedSection role="client">
        <div className="card" role="status" aria-live="polite">
          Loading your client portal...
        </div>
      </AuthenticatedSection>
    );
  }

  return (
    <AuthenticatedSection role="client">
        <header style={{ marginBottom: 20 }}>
          <h2>Client portal</h2>
          <p className="muted">Your jobs, invoices, photos, and activity. Only data shared with your account is visible.</p>
        </header>

        {message && (
          <div className="card" role="alert">
            {message}
          </div>
        )}

        {!message && (
          <>
            <nav className="inline-actions" style={{ marginBottom: 16 }} aria-label="Portal sections">
              {(['dashboard', 'jobs', 'invoices', 'profile'] as PortalTab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={tab === key ? 'btn btn-primary' : 'btn'}
                  onClick={() => setTab(key)}
                  aria-current={tab === key ? 'page' : undefined}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </nav>

            {tab === 'dashboard' && (
              <div className="card-grid">
                <div className="card">
                  <h3>Active jobs</h3>
                  <p>{jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled').length}</p>
                </div>
                <div className="card">
                  <h3>Reports</h3>
                  <p>{reports.length}</p>
                </div>
                <div className="card">
                  <h3>Invoices</h3>
                  <p>{invoices.length}</p>
                </div>
                <div className="card">
                  <h3>Recent activity</h3>
                  <p>{timeline.length} events</p>
                </div>
              </div>
            )}

            {tab === 'profile' && (
              <div className="card">
                <h3>Your profile</h3>
                <p>Name: {profile?.full_name || 'Not set'}</p>
                <p>Email: {profile?.email || 'Not set'}</p>
                <p>Phone: {profile?.phone || 'Not set'}</p>
                <p>Business: {profile?.business_name || 'Not set'}</p>
                {customers.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 16 }}>Customer records</h4>
                    {customers.map((c) => (
                      <div key={c.id} className="list-row">
                        <strong>{customerDisplayName(c)}</strong>
                        <p className="muted">{c.email || 'No email'} · {c.phone || 'No phone'}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {tab === 'invoices' && (
              <div className="card">
                <h3>Invoices</h3>
                {invoices.length === 0 && <p className="muted">No invoices shared with your account yet.</p>}
                {invoices.map((inv) => (
                  <div key={inv.id} className="list-row">
                    <div>
                      <strong>{inv.status || 'draft'}</strong>
                      <p className="muted">
                        {inv.amount != null ? `$${Number(inv.amount).toFixed(2)}` : 'Amount pending'}
                        {inv.due_date ? ` · Due ${inv.due_date}` : ''}
                      </p>
                      {inv.job_id && jobMap.get(inv.job_id) && (
                        <p className="muted">Job: {jobMap.get(inv.job_id)?.title}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'jobs' && (
              <>
                {jobs.length === 0 && <div className="card">No jobs shared with your account yet.</div>}
                {jobs.map((job) => (
                  <article key={job.id} className="card" style={{ marginTop: 16 }}>
                    <h3>{job.title}</h3>
                    <p>Status: {job.status || 'new'}</p>
                    <p>Due: {job.due_date || 'Not set'}</p>
                    {job.customer_notes && <p>{job.customer_notes}</p>}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
                      aria-expanded={selectedJob === job.id}
                    >
                      {selectedJob === job.id ? 'Hide photos' : 'View photos'}
                    </button>
                    {selectedJob === job.id ? (
                      <PhotoGallery
                        jobId={job.id}
                        refreshKey={0}
                        canView={photoAccessByJob[job.id] !== false}
                      />
                    ) : null}
                    {reports
                      .filter((r) => r.job_id === job.id)
                      .map((r) => (
                        <Link key={r.id} className="btn btn-primary" href={`/jobs/${job.id}/report`} style={{ marginTop: 8 }}>
                          View report: {r.title}
                        </Link>
                      ))}
                  </article>
                ))}

                {timeline.length > 0 && (
                  <div className="card" style={{ marginTop: 20 }}>
                    <h3>Activity timeline</h3>
                    {timeline.map((row) => (
                      <div key={row.id} className="list-row">
                        <div>
                          <strong>{jobMap.get(row.job_id)?.title || 'Job update'}</strong>
                          <p className="muted">{row.event_type} · {new Date(row.created_at).toLocaleString()}</p>
                          {row.message && <p>{row.message}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        <GoToDashboardLink role="client" className="btn" style={{ marginTop: 24 }}>
          Back to dashboard
        </GoToDashboardLink>
    </AuthenticatedSection>
  );
}
