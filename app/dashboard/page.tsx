'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AccessBlockedBanner } from '@/components/access-blocked-banner';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { PageHeader } from '@/components/page-header';
import { mapAccessError } from '@/lib/auth-errors';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canAccessNavHref } from '@/lib/nav-access';
import { isAdminRole, isClientRole, isContractorRole, isManagerRole, isStaffRole, normalizeRole, type UserRole } from '@/lib/roles';
import { formatLocalDate } from '@/lib/schedule-times';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

const dashboardCopy = {
  en: { todaysWork: "Today's work", loadError: 'Some information could not load.', loading: 'Loading…', retry: 'Retry', todaysJobs: "Today's Jobs", jobsNeedingAttention: 'Needs Attention', openLeads: 'Open Leads', myWork: 'My work', myJobs: 'My jobs', schedule: 'Schedule', newJob: 'New Job', nextJob: 'Next job', noUpcomingJob: 'No upcoming job', openJob: 'Open job' },
  es: { todaysWork: 'Trabajo de hoy', loadError: 'No se pudo cargar parte de la información.', loading: 'Cargando…', retry: 'Reintentar', todaysJobs: 'Trabajos de hoy', jobsNeedingAttention: 'Necesita atención', openLeads: 'Prospectos abiertos', myWork: 'Mi trabajo', myJobs: 'Mis trabajos', schedule: 'Calendario', newJob: 'Nuevo trabajo', nextJob: 'Próximo trabajo', noUpcomingJob: 'No hay trabajo próximo', openJob: 'Abrir trabajo' },
  vi: { todaysWork: 'Công việc hôm nay', loadError: 'Một số thông tin không thể tải.', loading: 'Đang tải…', retry: 'Thử lại', todaysJobs: 'Công việc hôm nay', jobsNeedingAttention: 'Cần chú ý', openLeads: 'Khách tiềm năng đang mở', myWork: 'Công việc của tôi', myJobs: 'Công việc của tôi', schedule: 'Lịch', newJob: 'Công việc mới', nextJob: 'Công việc tiếp theo', noUpcomingJob: 'Không có công việc sắp tới', openJob: 'Mở công việc' }
} as const;

const TIMEOUT_MS = 3500;
async function withTimeout<T>(task: PromiseLike<T>, fallback: T, timeoutMs = TIMEOUT_MS): Promise<T> { let timer: ReturnType<typeof setTimeout> | undefined; try { return await Promise.race([Promise.resolve(task), new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs); })]); } finally { if (timer) clearTimeout(timer); } }
function DashboardAccessNotice() { const params = useSearchParams(); const reason = params.get('reason'); if (!reason) return null; const mapped = mapAccessError(reason); return <AccessBlockedBanner title={mapped.title} message={mapped.message} details={params.get('detail') || mapped.details} />; }
function PriorityStat({ label, value, href }: { label: string; value: number; href: string }) { return <Link href={href} className="dashboard-revenue-metric is-primary" style={{ textDecoration: 'none' }}><span className="dashboard-revenue-metric-label">{label}</span><strong className="dashboard-revenue-metric-value">{value}</strong></Link>; }

type DashboardJob = { id: string; title?: string | null; customer_name?: string | null; address?: string | null; status?: string | null; assigned_to?: string | null; scheduled_start?: string | null; start_date?: string | null; due_date?: string | null; is_skipped?: boolean | null; };
type NextJob = { id: string; title: string; detail: string };
type OpsCounts = { todayJobs: number; needsAttention: number; openLeads: number; singleOpenLeadId: string | null; nextJob: NextJob | null };
function jobDateValue(job: DashboardJob) { const value = job.scheduled_start || job.start_date || job.due_date || ''; if (!value) return null; const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(parsed.getTime()) ? null : parsed; }
function formatNextJobDetail(job: DashboardJob, locale: string) { const value = jobDateValue(job); const date = value ? new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', ...(job.scheduled_start ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(value) : ''; return [date, job.customer_name, job.address].filter(Boolean).join(' · '); }
function todayTitle(locale: string) { const localeCode = locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US'; return new Intl.DateTimeFormat(localeCode, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()); }

export default function DashboardPage() {
  const { t, locale } = useTranslation(); const c = dashboardCopy[locale];
  const [plan, setPlan] = useState<EverittosPlan>('free'); const [role, setRole] = useState<UserRole>('owner'); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(false); const [ops, setOps] = useState<OpsCounts>({ todayJobs: 0, needsAttention: 0, openLeads: 0, singleOpenLeadId: null, nextJob: null });

  async function loadDashboard() {
    setLoading(true); setLoadError(false);

    /* The protected route has already passed the server auth boundary. Never
       convert a slow browser Supabase handoff into a forced logout. */
    const auth = await withTimeout<{ data: { user: { id: string } | null }; error: Error | null }>(supabase.auth.getUser(), { data: { user: null }, error: new Error('Authentication timed out') });
    let userId = auth.data.user?.id || null;
    if (!userId) {
      const session = await withTimeout(supabase.auth.getSession(), { data: { session: null }, error: new Error('Session timed out') });
      userId = session.data.session?.user?.id || null;
    }

    if (!userId) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    type ProfileRow = { plan?: string | null; role?: string | null };
    const [profileResult, organization] = await Promise.all([
      withTimeout<{ data: ProfileRow | null; error: Error | null }>(supabase.from('profiles').select('plan, role').eq('id', userId).maybeSingle(), { data: null, error: new Error('Profile timed out') }),
      withTimeout(ensureOrganizationForUser(userId), null)
    ]);
    const nextPlan = normalizePlan(profileResult.data?.plan); const nextRole = normalizeRole(organization?.role || profileResult.data?.role || 'owner');
    setPlan(nextPlan); setRole(nextRole);

    const organizationId = organization?.organizationId || null; const scopeColumn = organizationId ? 'organization_id' : 'user_id'; const scopeValue = organizationId || userId; const today = formatLocalDate(new Date());
    const jobSelect = 'id, title, customer_name, address, status, start_date, due_date, scheduled_start, assigned_to, is_skipped';
    const [jobsResult, leadsResult] = await Promise.all([
      withTimeout(supabase.from('jobs').select(jobSelect).eq(scopeColumn, scopeValue).or(`scheduled_start.gte.${today},start_date.gte.${today},due_date.gte.${today}`).order('scheduled_start', { ascending: true, nullsFirst: false }).limit(40), { data: [], error: new Error('Jobs timed out') }),
      withTimeout(supabase.from('customers').select('id, pipeline_stage').eq(scopeColumn, scopeValue).eq('record_type', 'lead').limit(100), { data: [], error: new Error('Customers timed out') })
    ]);
    const jobs = (jobsResult.data || []) as DashboardJob[];
    const activeJobs = jobs.filter((job) => !['completed', 'complete', 'done', 'finished', 'closed', 'cancelled', 'canceled', 'draft', 'skipped'].includes(String(job.status || '').toLowerCase()) && !job.is_skipped);
    const todayJobs = activeJobs.filter((job) => { const date = jobDateValue(job); return date ? formatLocalDate(date) === today : false; });
    const needsAttention = activeJobs.filter((job) => { const status = String(job.status || '').toLowerCase(); const due = (job.due_date || '').slice(0, 10); return !job.assigned_to || status === 'new' || Boolean(due && due < today); }).length;
    const openLeadRows = ((leadsResult.data || []) as Array<{ id: string; pipeline_stage: string | null }>).filter((row) => !['won', 'closed_lost', 'cancelled', 'lost'].includes(row.pipeline_stage || 'open'));
    const nextJobRow = activeJobs.filter((job) => { const date = jobDateValue(job); return date && formatLocalDate(date) >= today; }).sort((a, b) => (jobDateValue(a)?.getTime() || Number.MAX_SAFE_INTEGER) - (jobDateValue(b)?.getTime() || Number.MAX_SAFE_INTEGER))[0] || null;
    setOps({ todayJobs: todayJobs.length, needsAttention, openLeads: openLeadRows.length, singleOpenLeadId: openLeadRows.length === 1 ? openLeadRows[0].id : null, nextJob: nextJobRow ? { id: nextJobRow.id, title: String(nextJobRow.title || nextJobRow.customer_name || c.nextJob), detail: formatNextJobDetail(nextJobRow, locale === 'vi' ? 'vi-VN' : locale === 'es' ? 'es-US' : 'en-US') } : null });
    setLoadError(Boolean(auth.error || profileResult.error || jobsResult.error || leadsResult.error)); setLoading(false);
  }

  useEffect(() => { void loadDashboard(); }, []);
  const staffView = isStaffRole(role); const ownerView = isAdminRole(role); const managerView = isManagerRole(role) && !ownerView; const canLink = (href: string) => canAccessNavHref(role, href.split('?')[0], plan); const showOperations = (ownerView || managerView) && !staffView; const openLeadsHref = ops.singleOpenLeadId ? `/leads/${ops.singleOpenLeadId}` : '/leads';
  return <AppShell plan={plan} role={role} showBackButton={false}><Suspense><DashboardAccessNotice /></Suspense><div className="today-page dashboard-home">
    {ownerView ? <section className="owner-home-sheet" aria-label={c.nextJob}><PageHeader title={todayTitle(locale)} /><div className="owner-home-primary"><span className="owner-home-kicker">{c.nextJob}</span><h2>{ops.nextJob?.title || c.noUpcomingJob}</h2>{ops.nextJob?.detail ? <p>{ops.nextJob.detail}</p> : null}<div className="owner-home-actions"><Link className="btn btn-primary" href={ops.nextJob ? `/jobs/${ops.nextJob.id}` : '/schedule'}>{ops.nextJob ? c.openJob : c.schedule}</Link>{canLink('/jobs') ? <Link className="btn" href="/jobs/new">{c.newJob}</Link> : null}</div></div>{loadError ? <div role="status" className="owner-load-note"><p className="muted">{c.loadError}</p><button className="btn btn-sm" type="button" onClick={() => void loadDashboard()} disabled={loading}>{loading ? c.loading : c.retry}</button></div> : null}</section> : <PageHeader title={staffView ? t('dashboard.myWork') : c.todaysWork} />}
    {!ownerView && loadError ? <section role="status" className="owner-load-note"><p className="muted">{c.loadError}</p><button className="btn btn-sm" type="button" onClick={() => void loadDashboard()} disabled={loading}>{loading ? c.loading : c.retry}</button></section> : null}
    {!ownerView && showOperations ? <section aria-label={c.todaysWork} className="dashboard-operations"><div className="dashboard-revenue-grid">{canLink('/schedule') ? <PriorityStat label={c.todaysJobs} value={ops.todayJobs} href="/schedule" /> : null}{canLink('/jobs') ? <PriorityStat label={c.jobsNeedingAttention} value={ops.needsAttention} href="/jobs?status=active" /> : null}{canLink('/leads') ? <PriorityStat label={c.openLeads} value={ops.openLeads} href={openLeadsHref} /> : null}</div></section> : null}
    {staffView ? <section aria-label={c.myWork}><div className="inline-actions"><Link className="btn btn-primary" href="/jobs?mine=true">{c.myJobs}</Link><Link className="btn" href="/schedule">{c.schedule}</Link></div></section> : null}
  </div></AppShell>;
}
