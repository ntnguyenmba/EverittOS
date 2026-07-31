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

type WorkerRow = {
  id?: string | null;
  auth_user_id?: string | null;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  organization_id?: string | null;
};

export default function ContractorJobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const jobId = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState<ContractorSafeJobView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setView(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(contractorJobDetailPath(jobId))}`);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email, full_name, display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (!isContractorRole(normalizeRole(profile?.role))) {
      router.replace(`/jobs/${jobId}`);
      return;
    }

    const lookupEmail = String(user.email || profile?.email || '').trim().toLowerCase();
    const displayName = String(profile?.full_name || profile?.display_name || '').trim();
    const workerSelect = 'id, auth_user_id, email, name, full_name, organization_id';
    const [authWorkersRes, emailWorkersRes] = await Promise.all([
      supabase.from('workers').select(workerSelect).eq('auth_user_id', user.id),
      lookupEmail
        ? supabase.from('workers').select(workerSelect).ilike('email', lookupEmail)
        : Promise.resolve({ data: [] as WorkerRow[], error: null })
    ]);

    const workerMap = new Map<string, WorkerRow>();
    for (const row of [...(authWorkersRes.data || []), ...(emailWorkersRes.data || [])] as WorkerRow[]) {
      if (row.id) workerMap.set(String(row.id), row);
    }
    const workers = Array.from(workerMap.values());
    const identity = contractorIdentityFromWorkers(user.id, workers, lookupEmail, displayName);
    const workerIds = identity.workerIds || [];

    const [{ data: job }, { data: assignments }] = await Promise.all([
      supabase
        .from('jobs')
        .select(
          'id, title, status, start_date, due_date, scheduled_start, address, notes, customer_notes, customer_name, phone, assigned_to, organization_id'
        )
        .eq('id', jobId)
        .maybeSingle(),
      supabase.from('job_assignments').select('job_id, worker_id').eq('job_id', jobId)
    ]);

    if (!job) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const allowed = contractorCanAccessJob({
      job: { id: job.id, status: job.status, assigned_to: job.assigned_to },
      workerIds,
      assignments: assignments || []
    });

    if (!allowed) {
      router.replace(CONTRACTOR_HOME_PATH);
      return;
    }

    const { data: labor } = workerIds.length
      ? await supabase
          .from('job_labor')
          .select('total_cost, payment_status, worker_id')
          .eq('job_id', jobId)
          .in('worker_id', workerIds)
      : { data: [] };

    const workerIdSet = new Set(workerIds.map(String));
    const ownLabor = (labor || []).find(
      (row: { worker_id?: string | null; total_cost?: number | null; payment_status?: string | null }) =>
        workerIdSet.has(String(row.worker_id || ''))
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

  return (
    <AuthenticatedSection role="contractor">
      <div style={{ marginBottom: 16 }}>
        <Link href={CONTRACTOR_HOME_PATH} className="btn">
          {t('portal.contractor.back')}
        </Link>
      </div>

      {loading ? <div className="card">{t('portal.contractor.loading')}</div> : null}
      {!loading && notFound ? (
        <div className="card" role="alert">
          <p style={{ margin: 0 }}>{t('portal.contractor.jobNotFound')}</p>
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
                {view.scheduledDate || t('portal.common.dateNotSet')} · {translatePortalJobStatus(t, view.status)} ·{' '}
                {t('portal.contractor.viewOnly')}
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
                <a
                  className="btn"
                  style={{ marginTop: 8 }}
                  href={`https://maps.google.com/?q=${encodeURIComponent(view.address)}`}
                  target="_blank"
                  rel="noreferrer"
                >
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
