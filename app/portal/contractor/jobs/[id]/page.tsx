'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { CONTRACTOR_HOME_PATH, formatContractorMoney } from '@/lib/contractor-dashboard';
import { contractorJobDetailPath, type ContractorSafeJobView } from '@/lib/contractor-job-access';
import { translatePortalJobStatus, translatePortalPaymentStatus } from '@/lib/portal-status-i18n';

export default function ContractorJobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const jobId = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState<ContractorSafeJobView | null>(null);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setView(null);
    try {
      const response = await fetch(`/api/portal/contractor/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', cache: 'no-store' });
      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(contractorJobDetailPath(jobId))}`);
        return;
      }
      if (response.status === 403) {
        router.replace(CONTRACTOR_HOME_PATH);
        return;
      }
      if (response.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as { job?: ContractorSafeJobView; error?: string };
      if (!response.ok || !payload.job) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setView(payload.job);
      setLoading(false);
    } catch {
      setNotFound(true);
      setLoading(false);
    }
  }, [jobId, router]);

  useEffect(() => { void load(); }, [load]);

  async function updateJobStatus(status: 'active' | 'completed') {
    if (updating) return;
    if (status === 'completed' && !window.confirm('Mark this job complete?')) return;
    setUpdating(true);
    setActionError('');
    const response = await fetch(`/api/portal/contractor/jobs/${encodeURIComponent(jobId)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setUpdating(false);
    if (!response.ok) {
      setActionError(payload.error || 'Unable to update this job.');
      return;
    }
    await load();
  }

  const normalizedStatus = String(view?.status || '').toLowerCase();
  const isInProgress = normalizedStatus === 'active' || normalizedStatus === 'in_progress';

  return (
    <div className="contractor-dashboard">
      <div style={{ marginBottom: 16 }}><Link href={CONTRACTOR_HOME_PATH} className="btn">{t('portal.contractor.back')}</Link></div>

      {loading ? <div className="card">{t('portal.contractor.loading')}</div> : null}
      {!loading && notFound ? (
        <div className="card" role="alert">
          <p style={{ margin: 0 }}>{t('portal.contractor.jobNotFound')}</p>
          <Link href={CONTRACTOR_HOME_PATH} className="btn" style={{ marginTop: 12 }}>{t('portal.contractor.myJobs')}</Link>
        </div>
      ) : null}

      {!loading && view ? (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 28 }}>{view.title}</h1>
              <p className="muted" style={{ margin: '8px 0 0' }}>{view.scheduledDate || t('portal.common.dateNotSet')} · {translatePortalJobStatus(t, view.status)}</p>
            </div>
            {view.mode === 'cancelled' ? <span className="badge">{t('portal.contractor.cancelled')}</span> : null}
            {view.mode === 'completed' ? <span className="badge">{t('portal.contractor.completed')}</span> : null}
          </div>

          {view.mode === 'active' ? (
            <div style={{ marginTop: 18 }}>
              <button type="button" className="btn btn-primary" style={{ width: '100%', minHeight: 50 }} disabled={updating} onClick={() => void updateJobStatus(isInProgress ? 'completed' : 'active')}>
                {updating ? 'Updating…' : isInProgress ? 'Mark job complete' : 'Start job'}
              </button>
              {actionError ? <p className="auth-message auth-message-error" role="alert" style={{ marginTop: 10 }}>{actionError}</p> : null}
            </div>
          ) : null}

          <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
            {view.address ? (
              <div>
                <strong>{t('portal.contractor.address')}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>{view.address}</p>
                <a className="btn" style={{ marginTop: 8 }} href={`https://maps.google.com/?q=${encodeURIComponent(view.address)}`} target="_blank" rel="noreferrer">{t('portal.contractor.maps')}</a>
              </div>
            ) : null}
            {view.customerName ? <div><strong>{t('portal.contractor.customer')}</strong><p className="muted" style={{ margin: '4px 0 0' }}>{view.customerName}</p></div> : null}
            {view.phone ? <div><strong>{t('portal.contractor.contact')}</strong><p className="muted" style={{ margin: '4px 0 0' }}><a href={`tel:${view.phone}`}>{view.phone}</a></p></div> : null}
            {view.instructions ? <div><strong>{t('portal.contractor.instructions')}</strong><p className="muted" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{view.instructions}</p></div> : null}
            {view.payAmount != null ? (
              <div><strong>{t('portal.contractor.yourPay')}</strong><p className="portal-finance-amount" style={{ margin: '4px 0 0' }}>{formatContractorMoney(view.payAmount)}{view.paymentStatus ? ` · ${translatePortalPaymentStatus(t, view.paymentStatus)}` : ''}</p></div>
            ) : (
              <div><strong>{t('portal.contractor.yourPay')}</strong><p className="portal-finance-empty" style={{ margin: '4px 0 0' }}>{t('portal.contractor.payNotRecorded')}</p></div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
