'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { useTranslation } from '@/components/locale-provider';
import {
  CONTRACTOR_HOME_PATH,
  contractorIdentityFromWorkers,
  formatContractorMoney
} from '@/lib/contractor-dashboard';
import {
  contractorCanAccessJob,
  contractorJobDetailPath,
  toContractorSafeJobView,
  type ContractorSafeJobView
} from '@/lib/contractor-job-access';
import { translatePortalJobStatus, translatePortalPaymentStatus } from '@/lib/portal-status-i18n';
import { isContractorRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { ensureOrganizationForUser } from '@/lib/workspace-client';

type JobDetailError = 'workspace_not_found' | 'job_not_found' | 'no_access';

export default function ContractorJobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const jobId = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<JobDetailError | ''>('');
  const [view, setView] = useState<ContractorSafeJobView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setView(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(contractorJobDetailPath(jobId))}`);
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role, email, full_name, display_name').eq('id', user.id).maybeSingle();
    if (!isContractorRole(normalizeRole(profile?.role))) {
      router.replace(`/jobs/${jobId}`);
      return;
    }

    const org = await ensureOrganizationForUser(user.id);
    const organizationId = org?.organizationId || null;
    if (!organizationId) {
      setError('workspace_not_found');
      setLoading(false);
      return;
    }

    const lookupEmail = String(user.email || profile?.email || '').trim().toLowerCase();
    const { data: workers } = await supabase
      .from('workers')
      .select('id, auth_user_id, email, name, full_name')
      .eq('organization_id', organizationId);
    const identity = contractorIdentityFromWorkers(
      user.id,
      workers || [],
      lookupEmail,
      profile?.full_name || profile?.display_name
    );

    const [{ data: job }, { data: assignments }, { data: shares }, { data: labor }] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, title, status, start_date, due_date, scheduled_start, address, notes, customer_notes, customer_name, phone, assigned_to, organization_id')
        .eq('id', jobId)
        .eq('organization_id', organizationId)
        .maybeSingle(),
      supabase.from('job_assignments').select('job_id, worker_id').eq('job_id', jobId).eq('organization_id', organizationId),
      supabase
        .from('record_shares')
        .select('record_id, shared_with_user_id, access_level')
        .eq('organization_id', organizationId)
        .eq('record_type', 'job')
        .eq('record_id', jobId)
        .eq('shared_with_user_id', user.id),
      supabase
        .from('job_labor')
        .select('total_cost, payment_status, worker_id')
        .eq('organization_id', organizationId)
        .eq('job_id', jobId)
    ]);

    if (!job) {
      setError('job_not_found');
      setLoading(false);
      return;
    }

    const allowed = contractorCanAccessJob({
      job: { id: job.id, status: job.status, assigned_to: job.assigned_to },
      workerIds: identity.workerIds || [],
      userId: user.id,
      assignments: assignments || [],
      shares: shares || []
    });

    if (!allowed) {
      setError('no_access');
      setLoading(false);
      return;
    }

    const workerIds = new Set((identity.workerIds || []).map(String));
    const ownLabor = (labor || []).find((row: { worker_id?: string | null; total_cost?: number | null; payment_status?: string | null }) =>
      workerIds.has(String(row.worker_id || ''))
    );
    setView(
      toContractorSafeJobView({
        id: job.id,
        title: job.title,
        status: job.status,
        start_date: job.start_date,
        due_date: job.due_date,
        scheduled_start: job.scheduled_start,
        address: job.address,
        notes: job.notes,
        customer_notes: job.customer_notes,
        customer_name: job.customer_name,
        phone: job.phone,
        payAmount: ownLabor?.total_cost != null ? Number(ownLabor.total_cost) : null,
        paymentStatus: ownLabor?.payment_status || null
      })
    );
    setLoading(false);
  }, [jobId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  function errorText(code: JobDetailError): string {
    switch (code) {
      case 'workspace_not_found':
        return t('portal.contractor.workspaceNotFound');
      case 'job_not_found':
        return t('portal.contractor.jobNotFound');
      case 'no_access':
        return t('portal.contractor.noAccess');
    }
  }

  return (
    <AuthenticatedSection role="contractor">
      <div style={{ marginBottom: 16 }}>
        <Link href={CONTRACTOR_HOME_PATH} className="btn">
          {t('portal.contractor.back')}
        </Link>
      </div>

      {loading ? <div className="card">{t('portal.contractor.loading')}</div> : null}
      {!loading && error ? (
        <div className="card" role="alert">
          <p style={{ margin: 0 }}>{errorText(error)}</p>
          <Link href={CONTRACTOR_HOME_PATH} className="btn" style={{ marginTop: 12 }}>
            {t('portal.contractor.myJobs')}
          </Link>
        </div>
      ) : null}

      {!loading && view ? (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28 }}>{view.title}</h1>
              <p className="muted" style={{ margin: '8px 0 0' }}>
                {view.scheduledDate || t('portal.common.dateNotSet')} · {translatePortalJobStatus(t, view.status)}
                {view.readOnly ? ` · ${t('portal.contractor.viewOnly')}` : ''}
              </p>
            </div>
            {view.mode === 'cancelled' ? <span className="badge">{t('portal.contractor.cancelled')}</span> : null}
            {view.mode === 'completed' ? <span className="badge">{t('portal.contractor.completed')}</span> : null}
          </div>

          <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
            {view.customerName ? (
              <div>
                <strong>{t('portal.contractor.customer')}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {view.customerName}
                </p>
              </div>
            ) : null}
            {view.address ? (
              <div>
                <strong>{t('portal.contractor.address')}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {view.address}
                </p>
                <a className="btn" style={{ marginTop: 8 }} href={`https://maps.google.com/?q=${encodeURIComponent(view.address)}`} target="_blank" rel="noreferrer">
                  {t('portal.contractor.maps')}
                </a>
              </div>
            ) : null}
            {view.phone ? (
              <div>
                <strong>{t('portal.contractor.contact')}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  <a href={`tel:${view.phone}`}>{view.phone}</a>
                </p>
              </div>
            ) : null}
            {view.instructions ? (
              <div>
                <strong>{t('portal.contractor.instructions')}</strong>
                <p className="muted" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                  {view.instructions}
                </p>
              </div>
            ) : null}
            {view.payAmount != null ? (
              <div>
                <strong>{t('portal.contractor.yourPay')}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {formatContractorMoney(view.payAmount)}
                  {view.paymentStatus ? ` · ${translatePortalPaymentStatus(t, view.paymentStatus)}` : ''}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </AuthenticatedSection>
  );
}
