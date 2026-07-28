'use client';

import Link from 'next/link';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PhotoGallery } from '@/components/photo-gallery';
import { useTranslation } from '@/components/locale-provider';
import { PortalClientNav } from '@/components/portal/portal-client-nav';
import { normalizePlan } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import { CLIENT_SETTINGS_PATH } from '@/lib/client-portal';
import { clientPortalJobsPath, CLIENT_PORTAL_HOME } from '@/lib/portal-access';
import { translatePortalJobStatus, translatePortalPaymentStatus } from '@/lib/portal-status-i18n';
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

type PortalTab = 'dashboard' | 'jobs' | 'schedule' | 'reports' | 'invoices' | 'profile';

function ClientPortalFallback() {
  const { t } = useTranslation();
  return (
    <main className="section">
      <div className="container">
        <div className="card">{t('portal.client.loadingPortal')}</div>
      </div>
    </main>
  );
}

export default function ClientPortalPage() {
  return (
    <Suspense fallback={<ClientPortalFallback />}>
      <ClientPortalContent />
    </Suspense>
  );
}

function ClientPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const portalToken = searchParams.get('token');
  const requestedTab = searchParams.get('tab');
  const initialTab: PortalTab =
    requestedTab === 'jobs' ||
    requestedTab === 'schedule' ||
    requestedTab === 'reports' ||
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

  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const upcomingJobs = useMemo(
    () =>
      jobs
        .filter((job) => job.status !== 'completed' && job.status !== 'cancelled')
        .slice()
        .sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || ''))),
    [jobs]
  );
  useEffect(() => {
    if (
      requestedTab === 'jobs' ||
      requestedTab === 'schedule' ||
      requestedTab === 'reports' ||
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

      // Repair incomplete historical client invite relationships before loading jobs.
      try {
        await fetch('/api/portal/client/repair', { method: 'POST' });
      } catch {
        // Portal still loads with whatever access is already present.
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

      // Client portal guests are not EverittOS subscribers — never gate them on Growth/billing.
      if (!isClientRole(role) && !limitsForPlan(plan).clientPortal) {
        setMessage(t('portal.client.growthRequired'));
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
        setMessage(t('portal.client.wrongAccountLink'));
        setLoading(false);
        return;
      }

      const accessMap: Record<string, boolean> = {};
      (access || []).forEach((row: { job_id: string; can_view_photos?: boolean | null }) => {
        accessMap[row.job_id as string] = row.can_view_photos !== false;
      });
      setPhotoAccessByJob(accessMap);

      const jobIds = (access || []).map((a: { job_id: string }) => a.job_id);

      // After login / invite: one shared job opens immediately; never send clients to pricing.
      if (isClientRole(role) && !portalToken && !requestedTab && jobIds.length === 1) {
        router.replace(clientPortalJobsPath(jobIds[0]));
        return;
      }

      if (jobIds.length === 0) {
        if (isClientRole(role)) {
          setMessage(t('portal.client.noSharedMessage'));
        }
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
  }, [router, portalToken, requestedTab, t]);

  if (loading) {
    return (
      <AuthenticatedSection role="client">
        <div className="card" role="status" aria-live="polite">
          {t('portal.client.loadingPortal')}
        </div>
      </AuthenticatedSection>
    );
  }

  const tabButtons = (['dashboard', 'jobs', 'schedule', 'reports', 'invoices'] as PortalTab[]).map((key) => (
    <button
      key={key}
      type="button"
      className={tab === key ? 'btn btn-primary' : 'btn'}
      onClick={() => setTab(key)}
      aria-current={tab === key ? 'page' : undefined}
    >
      {t(`portal.client.tabs.${key}`)}
    </button>
  ));

  return (
    <AuthenticatedSection role="client">
        <header style={{ marginBottom: 20 }}>
          <h2>{t('portal.client.yourService')}</h2>
        </header>

        <PortalClientNav
          active="overview"
          overviewHref={CLIENT_PORTAL_HOME}
          appointmentsHref={clientPortalJobsPath()}
          accountHref={CLIENT_SETTINGS_PATH}
          extraActions={tabButtons}
        />

        {message && (
          <div className="card" role="alert">
            {message}
          </div>
        )}

        {!message && (
          <>
            {tab === 'dashboard' && (
              <>
                <div className="card">
                  <h3>{t('portal.client.dashboard.upcomingAppointment')}</h3>
                  {upcomingJobs[0] ? (
                    <div className="list-row">
                      <div>
                        <strong>{upcomingJobs[0].title}</strong>
                        <p className="muted">
                          {upcomingJobs[0].due_date || t('portal.common.dateNotSet')} ·{' '}
                          {translatePortalJobStatus(t, upcomingJobs[0].status)}
                        </p>
                      </div>
                      <Link className="btn" href={clientPortalJobsPath(upcomingJobs[0].id)}>
                        {t('portal.common.view')}
                      </Link>
                    </div>
                  ) : (
                    <p className="muted">{t('portal.client.dashboard.noUpcoming')}</p>
                  )}
                </div>

                <div className="card" style={{ marginTop: 16 }}>
                  <h3>{t('portal.client.dashboard.jobStatus')}</h3>
                  {jobs.length === 0 ? (
                    <p className="muted">{t('portal.client.dashboard.noJobsShared')}</p>
                  ) : (
                    jobs.slice(0, 4).map((job) => (
                      <div key={job.id} className="list-row">
                        <div>
                          <strong>{job.title}</strong>
                          <p className="muted">{translatePortalJobStatus(t, job.status)}</p>
                        </div>
                        <Link className="btn" href={clientPortalJobsPath(job.id)}>
                          {t('portal.common.open')}
                        </Link>
                      </div>
                    ))
                  )}
                </div>

                <div className="card" style={{ marginTop: 16 }}>
                  <h3>{t('portal.client.dashboard.invoicesPayments')}</h3>
                  {invoices.length === 0 ? (
                    <p className="muted">{t('portal.client.dashboard.noInvoices')}</p>
                  ) : (
                    invoices.slice(0, 4).map((inv) => (
                      <div key={inv.id} className="list-row">
                        <div>
                          <strong>
                            {jobMap.get(String(inv.job_id || ''))?.title ||
                              t('portal.client.dashboard.invoiceFallback')}
                          </strong>
                          <p className="muted">
                            {translatePortalPaymentStatus(t, inv.status)}
                            {inv.amount != null ? ` · $${Number(inv.amount).toFixed(2)}` : ''}
                          </p>
                        </div>
                        <button type="button" className="btn" onClick={() => setTab('invoices')}>
                          {t('portal.common.open')}
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="card" style={{ marginTop: 16 }}>
                  <h3>{t('portal.client.dashboard.reportsPhotos')}</h3>
                  {reports.filter((r) => r.share_token && !r.share_revoked_at).length === 0 ? (
                    <p className="muted">{t('portal.client.dashboard.noSharedReports')}</p>
                  ) : (
                    <button type="button" className="btn" onClick={() => setTab('reports')}>
                      {t('portal.client.dashboard.viewReportsPhotos')}
                    </button>
                  )}
                </div>
              </>
            )}

            {tab === 'schedule' && (
              <div className="card">
                <h3>{t('portal.client.schedule.title')}</h3>
                {upcomingJobs.length === 0 ? (
                  <p className="muted">{t('portal.client.dashboard.noUpcoming')}</p>
                ) : (
                  upcomingJobs.map((job) => (
                    <div key={job.id} className="list-row">
                      <div>
                        <strong>{job.title}</strong>
                        <p className="muted">
                          {job.due_date || t('portal.common.dateNotSet')} ·{' '}
                          {translatePortalJobStatus(t, job.status)}
                        </p>
                      </div>
                      <button type="button" className="btn" onClick={() => setTab('jobs')}>
                        {t('portal.client.schedule.viewDetails')}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'profile' && (
              <div className="card">
                <h3>{t('portal.client.profile.title')}</h3>
                <p>
                  {t('portal.client.profile.name')}: {profile?.full_name || t('portal.client.profile.notSet')}
                </p>
                <p>
                  {t('portal.client.profile.email')}: {profile?.email || t('portal.client.profile.notSet')}
                </p>
                <p>
                  {t('portal.client.profile.phone')}: {profile?.phone || t('portal.client.profile.notSet')}
                </p>
                <p>
                  {t('portal.client.profile.business')}:{' '}
                  {profile?.business_name || t('portal.client.profile.notSet')}
                </p>
                {customers.length > 0 && (
                  <>
                    <h4 style={{ marginTop: 16 }}>{t('portal.client.profile.linkedCustomers')}</h4>
                    {customers.map((c) => (
                      <div key={c.id} className="list-row">
                        <strong>{customerDisplayName(c)}</strong>
                        <p className="muted">
                          {c.email || t('portal.client.profile.noEmail')} ·{' '}
                          {c.phone || t('portal.client.profile.noPhone')}
                        </p>
                      </div>
                    ))}
                  </>
                )}
                <div className="button-row" style={{ marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                  <Link href={CLIENT_SETTINGS_PATH} className="btn btn-primary">
                    {t('portal.client.profile.editAccount')}
                  </Link>
                  <Link href="/disclaimer/customer" className="btn">
                    {t('portal.client.profile.customerDisclaimer')}
                  </Link>
                </div>
              </div>
            )}

            {tab === 'reports' && (
              <>
                <div className="card">
                  <h3>{t('portal.client.reportsTab.sharedReports')}</h3>
                  {reports.filter((r) => r.share_token && !r.share_revoked_at).length === 0 ? (
                    <p className="muted">{t('portal.client.reportsTab.noReportsShared')}</p>
                  ) : (
                    reports
                      .filter((r) => r.share_token && !r.share_revoked_at)
                      .map((r) => (
                        <div key={r.id} className="list-row">
                          <div>
                            <strong>{r.title}</strong>
                            <p className="muted">
                              {jobMap.get(r.job_id)?.title || t('portal.client.reportsTab.appointmentReport')}
                            </p>
                          </div>
                          <Link className="btn btn-primary" href={`/report/${r.share_token}`}>
                            {t('portal.client.openReport')}
                          </Link>
                        </div>
                      ))
                  )}
                </div>
                <div className="card" style={{ marginTop: 16 }}>
                  <h3>{t('portal.client.reportsTab.photosHeading')}</h3>
                  {jobs.length === 0 ? (
                    <p className="muted">{t('portal.client.reportsTab.noAppointments')}</p>
                  ) : (
                    jobs.map((job) => (
                      <div key={`photos-${job.id}`} style={{ marginTop: 12 }}>
                        <strong>{job.title}</strong>
                        <div style={{ marginTop: 8 }}>
                          <PhotoGallery
                            jobId={job.id}
                            refreshKey={0}
                            canView={photoAccessByJob[job.id] !== false}
                            customerOnly
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {tab === 'invoices' && (
              <div className="card">
                <h3>{t('portal.client.invoicesTab.title')}</h3>
                {invoices.length === 0 && (
                  <p className="muted">{t('portal.client.invoicesTab.none')}</p>
                )}
                {invoices.map((inv) => (
                  <div key={inv.id} className="list-row">
                    <div>
                      <strong>{translatePortalPaymentStatus(t, inv.status)}</strong>
                      <p className="muted">
                        {inv.amount != null
                          ? `$${Number(inv.amount).toFixed(2)}`
                          : t('portal.client.amountPending')}
                        {inv.due_date ? ` · ${t('portal.common.due')} ${inv.due_date}` : ''}
                      </p>
                      {inv.job_id && jobMap.get(inv.job_id) && (
                        <p className="muted">
                          {t('portal.client.invoicesTab.jobLabel')}: {jobMap.get(inv.job_id)?.title}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'jobs' && (
              <>
                {jobs.length === 0 && (
                  <div className="card" role="status">
                    <h3>{t('portal.client.jobsTab.emptyTitle')}</h3>
                    <p className="muted">{t('portal.client.jobsTab.emptyBody')}</p>
                  </div>
                )}
                {jobs.map((job) => (
                  <article key={job.id} className="card" style={{ marginTop: 16 }}>
                    <div className="list-row">
                      <div>
                        <h3 style={{ margin: 0 }}>{job.title}</h3>
                        <p>
                          {t('portal.common.status')}: {translatePortalJobStatus(t, job.status)}
                        </p>
                        <p>
                          {t('portal.common.due')}: {job.due_date || t('portal.common.notSet')}
                        </p>
                        {job.customer_notes && <p>{job.customer_notes}</p>}
                      </div>
                      <Link className="btn btn-primary" href={clientPortalJobsPath(job.id)}>
                        {t('portal.client.openJob')}
                      </Link>
                    </div>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
                      aria-expanded={selectedJob === job.id}
                      style={{ marginTop: 8 }}
                    >
                      {selectedJob === job.id
                        ? t('portal.client.jobsTab.hidePhotos')
                        : t('portal.client.jobsTab.viewPhotos')}
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
                        <Link
                          key={r.id}
                          className="btn btn-primary"
                          href={`/report/${r.share_token}`}
                          style={{ marginTop: 8 }}
                        >
                          {t('portal.client.openReport')}: {r.title}
                        </Link>
                      ))}
                    {reports.filter((r) => r.job_id === job.id && r.share_token && !r.share_revoked_at)
                      .length === 0 ? (
                      <p className="muted" style={{ marginTop: 8 }}>
                        {t('portal.client.jobsTab.noReportsForJob')}
                      </p>
                    ) : null}
                  </article>
                ))}

                {timeline.length > 0 && (
                  <div className="card" style={{ marginTop: 20 }}>
                    <h3>{t('portal.client.jobsTab.activityTimeline')}</h3>
                    {timeline.map((row) => (
                      <div key={row.id} className="list-row">
                        <div>
                          <strong>
                            {jobMap.get(row.job_id)?.title || t('portal.client.jobsTab.jobUpdate')}
                          </strong>
                          <p className="muted">
                            {row.event_type} · {new Date(row.created_at).toLocaleString()}
                          </p>
                          {row.message && <p>{row.message}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <section className="card" style={{ marginTop: 20 }} aria-label={t('portal.legal.title')}>
              <h3>{t('portal.legal.title')}</h3>
              <div className="button-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <Link className="btn" href="/privacy">
                  {t('portal.legal.privacy')}
                </Link>
                <Link className="btn" href="/terms">
                  {t('portal.legal.terms')}
                </Link>
                <Link className="btn" href="/disclaimer/customer">
                  {t('portal.legal.customerDisclaimer')}
                </Link>
                <Link className="btn" href={CLIENT_SETTINGS_PATH}>
                  {t('portal.client.settingsTitle')}
                </Link>
              </div>
            </section>
          </>
        )}
    </AuthenticatedSection>
  );
}
