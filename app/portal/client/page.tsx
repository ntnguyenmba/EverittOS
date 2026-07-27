'use client';

import Link from 'next/link';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PhotoGallery } from '@/components/photo-gallery';
import { normalizePlan } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import { CLIENT_SETTINGS_PATH, clientNavItems } from '@/lib/client-portal';
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

type ClientReport = {
  id: string;
  title: string;
  job_id: string;
  share_token: string | null;
  share_revoked_at: string | null;
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

type PortalTab = 'dashboard' | 'jobs' | 'schedule' | 'invoices' | 'profile';

const TAB_LABELS: Record<PortalTab, string> = {
  dashboard: 'Overview',
  jobs: 'My jobs',
  schedule: 'Schedule',
  invoices: 'Invoices',
  profile: 'Account'
};

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
  const requestedTab = searchParams.get('tab');
  const initialTab: PortalTab =
    requestedTab === 'jobs' ||
    requestedTab === 'schedule' ||
    requestedTab === 'invoices' ||
    requestedTab === 'profile' ||
    requestedTab === 'dashboard'
      ? requestedTab
      : 'dashboard';
  const [tab, setTab] = useState<PortalTab>(initialTab);
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [photoAccessByJob, setPhotoAccessByJob] = useState<Record<string, boolean>>({});
  const [signingOut, setSigningOut] = useState(false);

  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const upcomingJobs = useMemo(
    () =>
      jobs
        .filter((job) => job.status !== 'completed' && job.status !== 'cancelled')
        .slice()
        .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || ''))),
    [jobs]
  );
  const navItems = useMemo(() => clientNavItems(), []);

  useEffect(() => {
    if (
      requestedTab === 'jobs' ||
      requestedTab === 'schedule' ||
      requestedTab === 'invoices' ||
      requestedTab === 'profile' ||
      requestedTab === 'dashboard'
    ) {
      setTab(requestedTab);
    }
  }, [requestedTab]);

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
        setMessage('Client portal requires Growth plan or higher, or a client role.');
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
      (access || []).forEach((row: { job_id: string; can_view_photos?: boolean | null }) => {
        accessMap[row.job_id as string] = row.can_view_photos !== false;
      });
      setPhotoAccessByJob(accessMap);

      const jobIds = (access || []).map((a: { job_id: string }) => a.job_id);
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
        supabase
          .from('job_reports')
          .select('id, title, job_id, share_token, share_revoked_at')
          .in('job_id', jobIds),
        supabase
          .from('job_timeline')
          .select('id, job_id, message, event_type, created_at')
          .in('job_id', jobIds)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      setReports((reportRows || []) as ClientReport[]);
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

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/sign-out', { method: 'POST', keepalive: true });
      await supabase.auth.signOut();
    } finally {
      router.push('/login');
      setSigningOut(false);
    }
  }

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
          <h2>Customer portal</h2>
          <p className="muted">Your jobs, invoices, photos, and activity. Only data shared with your account is visible.</p>
        </header>

        <nav className="inline-actions" style={{ marginBottom: 16, flexWrap: 'wrap' }} aria-label="Portal sections">
          {(['dashboard', 'jobs', 'schedule', 'invoices'] as PortalTab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={tab === key ? 'btn btn-primary' : 'btn'}
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
          <Link href={CLIENT_SETTINGS_PATH} className="btn">
            Account
          </Link>
          <button type="button" className="btn" onClick={() => void signOut()} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </nav>

        {message && (
          <div className="card" role="alert">
            {message}
          </div>
        )}

        {!message && (
          <>
            {tab === 'dashboard' && (
              <>
                <div className="card-grid">
                  <div className="card">
                    <h3>Upcoming appointments</h3>
                    <p>{upcomingJobs.length}</p>
                  </div>
                  <div className="card">
                    <h3>Shared reports</h3>
                    <p>{reports.filter((r) => r.share_token && !r.share_revoked_at).length}</p>
                  </div>
                  <div className="card">
                    <h3>Open invoices</h3>
                    <p>{invoices.filter((inv) => inv.status !== 'paid' && inv.status !== 'void').length}</p>
                  </div>
                  <div className="card">
                    <h3>Recent activity</h3>
                    <p>{timeline.length} events</p>
                  </div>
                </div>
                <div className="card" style={{ marginTop: 16 }}>
                  <h3>Quick links</h3>
                  <div className="button-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    {navItems.map((item) => (
                      <Link key={item.id} href={item.href} className="btn">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'schedule' && (
              <div className="card">
                <h3>Schedule</h3>
                {upcomingJobs.length === 0 ? (
                  <p className="muted">No upcoming appointments.</p>
                ) : (
                  upcomingJobs.map((job) => (
                    <div key={job.id} className="list-row">
                      <div>
                        <strong>{job.title}</strong>
                        <p className="muted">{job.due_date || 'Date not set'} · {job.status || 'scheduled'}</p>
                      </div>
                      <button type="button" className="btn" onClick={() => setTab('jobs')}>
                        View details
                      </button>
                    </div>
                  ))
                )}
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
                    <h4 style={{ marginTop: 16 }}>Linked customer records</h4>
                    {customers.map((c) => (
                      <div key={c.id} className="list-row">
                        <strong>{customerDisplayName(c)}</strong>
                        <p className="muted">{c.email || 'No email'} · {c.phone || 'No phone'}</p>
                      </div>
                    ))}
                  </>
                )}
                <div className="button-row" style={{ marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                  <Link href={CLIENT_SETTINGS_PATH} className="btn btn-primary">
                    Edit account settings
                  </Link>
                  <Link href="/disclaimer/customer" className="btn">
                    Customer portal disclaimer
                  </Link>
                </div>
              </div>
            )}

            {tab === 'invoices' && (
              <div className="card">
                <h3>Invoices and payments</h3>
                {invoices.length === 0 && <p className="muted">You do not have any open invoices.</p>}
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
                {jobs.length === 0 && <div className="card">No upcoming appointments.</div>}
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
                        customerOnly
                      />
                    ) : null}
                    {reports
                      .filter((r) => r.job_id === job.id && r.share_token && !r.share_revoked_at)
                      .map((r) => (
                        <Link key={r.id} className="btn btn-primary" href={`/report/${r.share_token}`} style={{ marginTop: 8 }}>
                          View report: {r.title}
                        </Link>
                      ))}
                    {reports.filter((r) => r.job_id === job.id && r.share_token && !r.share_revoked_at).length === 0 ? (
                      <p className="muted" style={{ marginTop: 8 }}>
                        No reports have been shared with you for this job.
                      </p>
                    ) : null}
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

            <section className="card" style={{ marginTop: 20 }} aria-label="Legal">
              <h3>Legal</h3>
              <div className="button-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <Link className="btn" href="/privacy">
                  Privacy Policy
                </Link>
                <Link className="btn" href="/terms">
                  Terms of Service
                </Link>
                <Link className="btn" href="/disclaimer/customer">
                  Customer Portal Disclaimer
                </Link>
                <Link className="btn" href={CLIENT_SETTINGS_PATH}>
                  Account settings
                </Link>
              </div>
            </section>
          </>
        )}
    </AuthenticatedSection>
  );
}
