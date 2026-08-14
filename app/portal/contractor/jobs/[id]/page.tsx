'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { CONTRACTOR_HOME_PATH, formatContractorMoney } from '@/lib/worker-dashboard';
import { contractorJobDetailPath, type ContractorSafeJobView } from '@/lib/worker-job-access';
import { translatePortalJobStatus, translatePortalPaymentStatus } from '@/lib/portal-status-i18n';

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

    try {
      const response = await fetch(`/api/portal/contractor/jobs/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        cache: 'no-store'
      });

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

      const payload = (await response.json().catch(() => ({}))) as {
        job?: ContractorSafeJobView;
        error?: string;
      };
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

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="worker-dashboard">
      <div style={{ marginBottom: 16 }}>
        <Link href={CONTRACTOR_HOME_PATH} className="btn">
          {t('portal.worker.back')}
        </Link>
      </div>

      {loading ? <div className="card">{t('portal.worker.loading')}</div> : null}
      {!loading && notFound ? (
        <div className="card" role="alert">
          <p style={{ margin: 0 }}>{t('portal.worker.jobNotFound')}</p>
          <Link href={CONTRACTOR_HOME_PATH} className="btn" style={{ marginTop: 12 }}>
            {t('portal.worker.myJobs')}
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
                {t('portal.worker.viewOnly')}
              </p>
            </div>
            {view.mode === 'cancelled' ? <span className="badge">{t('portal.worker.cancelled')}</span> : null}
            {view.mode === 'completed' ? <span className="badge">{t('portal.worker.completed')}</span> : null}
          </div>

          <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
            {view.customerName ? (
              <div>
                <strong>{t('portal.worker.customer')}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {view.customerName}
                </p>
              </div>
            ) : null}
            {view.address ? (
              <div>
                <strong>{t('portal.worker.address')}</strong>
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
                  {t('portal.worker.maps')}
                </a>
              </div>
            ) : null}
            {view.phone ? (
              <div>
                <strong>{t('portal.worker.contact')}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  <a href={`tel:${view.phone}`}>{view.phone}</a>
                </p>
              </div>
            ) : null}
            {view.instructions ? (
              <div>
                <strong>{t('portal.worker.instructions')}</strong>
                <p className="muted" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                  {view.instructions}
                </p>
              </div>
            ) : null}
            {view.payAmount != null ? (
              <div>
                <strong>{t('portal.worker.yourPay')}</strong>
                <p className="portal-finance-amount" style={{ margin: '4px 0 0' }}>
                  {formatContractorMoney(view.payAmount)}
                  {view.paymentStatus ? ` · ${translatePortalPaymentStatus(t, view.paymentStatus)}` : ''}
                </p>
              </div>
            ) : (
              <div>
                <strong>{t('portal.worker.yourPay')}</strong>
                <p className="portal-finance-empty" style={{ margin: '4px 0 0' }}>
                  {t('portal.worker.payNotRecorded')}
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
