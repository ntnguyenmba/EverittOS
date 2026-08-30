'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { CONTRACTOR_HOME_PATH, formatContractorMoney } from '@/lib/contractor-dashboard';
import { contractorJobDetailPath, type ContractorSafeJobView } from '@/lib/contractor-job-access';
import { translatePortalJobStatus, translatePortalPaymentStatus } from '@/lib/portal-status-i18n';
import { drainContractorOutbox, queueContractorStatus, readContractorJob, saveContractorJob } from '@/lib/contractor-offline';
import { supabase } from '@/lib/supabase';

type PhotoTag = 'before' | 'after';
const fieldCopy = {
  en: { start:'Start job', complete:'Complete job', updating:'Updating...', confirm:'Mark this job complete?', updateError:'Unable to update this job.', before:'Before photo', after:'After photo', addBefore:'Add before photo', addAfter:'Add after photo', uploading:'Uploading photo...', photoAdded:'photo added.', photoError:'Photo could not be added.', jobDetails:'Job details', photos:'Photos', finish:'Finish job' },
  es: { start:'Iniciar trabajo', complete:'Completar trabajo', updating:'Actualizando...', confirm:'¿Marcar este trabajo como completado?', updateError:'No se pudo actualizar este trabajo.', before:'Foto antes', after:'Foto después', addBefore:'Agregar foto antes', addAfter:'Agregar foto después', uploading:'Subiendo foto...', photoAdded:'agregada.', photoError:'No se pudo agregar la foto.', jobDetails:'Detalles del trabajo', photos:'Fotos', finish:'Finalizar trabajo' },
  vi: { start:'Bắt đầu công việc', complete:'Hoàn thành công việc', updating:'Đang cập nhật...', confirm:'Đánh dấu công việc này đã hoàn thành?', updateError:'Không thể cập nhật công việc.', before:'Ảnh trước', after:'Ảnh sau', addBefore:'Thêm ảnh trước', addAfter:'Thêm ảnh sau', uploading:'Đang tải ảnh...', photoAdded:'đã được thêm.', photoError:'Không thể thêm ảnh.', jobDetails:'Chi tiết công việc', photos:'Hình ảnh', finish:'Hoàn thành' }
} as const;

export default function ContractorJobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = fieldCopy[locale] || fieldCopy.en;
  const jobId = String(params?.id || '');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [view, setView] = useState<ContractorSafeJobView | null>(null);
  const [userId, setUserId] = useState('');
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState('');
  const [photoTag, setPhotoTag] = useState<PhotoTag>('before');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setNotFound(false);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id || '';
    setUserId(uid);
    if (uid) {
      const cached = await readContractorJob(uid, jobId);
      if (cached) { setView(cached); setLoading(false); }
    }
    try {
      void drainContractorOutbox();
      const response = await fetch(`/api/portal/contractor/jobs/${encodeURIComponent(jobId)}`, { method:'GET', cache:'no-store' });
      if (response.status === 401) { if (!view) router.replace(`/login?next=${encodeURIComponent(contractorJobDetailPath(jobId))}`); return; }
      if (response.status === 403) { if (!view) router.replace(CONTRACTOR_HOME_PATH); return; }
      if (response.status === 404) { if (!view) { setNotFound(true); setLoading(false); } return; }
      const payload = (await response.json().catch(() => ({}))) as { job?: ContractorSafeJobView; error?: string };
      if (!response.ok || !payload.job) { if (!view) { setNotFound(true); setLoading(false); } return; }
      setView(payload.job); setLoading(false);
      if (uid) await saveContractorJob(uid, payload.job);
    } catch {
      if (!view) { setNotFound(true); setLoading(false); }
    }
  }, [jobId, router, view]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const sync = () => { if (navigator.onLine) void drainContractorOutbox().then(() => load()); };
    window.addEventListener('online', sync);
    window.addEventListener('pageshow', sync);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('pageshow', sync); };
  }, [load]);

  async function updateJobStatus(status: 'active' | 'completed') {
    if (updating || !view) return;
    if (status === 'completed' && !window.confirm(c.confirm)) return;
    setUpdating(true); setActionError('');
    const previous = view;
    const optimistic: ContractorSafeJobView = { ...view, status, mode: status === 'completed' ? 'completed' : 'active' };
    setView(optimistic);
    if (userId) await saveContractorJob(userId, optimistic);
    try {
      const response = await fetch(`/api/portal/contractor/jobs/${encodeURIComponent(jobId)}/status`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status }) });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
          setView(previous); if (userId) await saveContractorJob(userId, previous); setActionError(payload.error || c.updateError); setUpdating(false); return;
        }
        throw new Error(payload.error || c.updateError);
      }
      setUpdating(false); await load();
    } catch {
      if (userId) await queueContractorStatus(userId, jobId, status);
      setUpdating(false);
    }
  }

  function choosePhoto(tag: PhotoTag) { setPhotoTag(tag); setPhotoMessage(''); photoInputRef.current?.click(); }
  async function uploadPhoto(file: File | undefined) {
    if (!file || uploadingPhoto) return;
    setUploadingPhoto(true); setPhotoMessage('');
    const body = new FormData(); body.append('file', file); body.append('tag', photoTag);
    try {
      const response = await fetch(`/api/portal/contractor/jobs/${encodeURIComponent(jobId)}/photos`, { method:'POST', body });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setPhotoMessage(response.ok ? `${photoTag === 'before' ? c.before : c.after} ${c.photoAdded}` : payload.error || c.photoError);
    } catch { setPhotoMessage(c.photoError); }
    setUploadingPhoto(false); if (photoInputRef.current) photoInputRef.current.value = '';
  }

  const normalizedStatus = String(view?.status || '').toLowerCase();
  const isInProgress = normalizedStatus === 'active' || normalizedStatus === 'in_progress';

  return <div className="contractor-dashboard contractor-job-packet">
    {loading ? <div className="card">{t('portal.contractor.loading')}</div> : null}
    {!loading && notFound ? <div className="card" role="alert"><p>{t('portal.contractor.jobNotFound')}</p><Link href={CONTRACTOR_HOME_PATH} className="btn">{t('portal.contractor.myJobs')}</Link></div> : null}
    {!loading && view ? <section className="card contractor-job-packet-card">
      <header className="contractor-job-packet-head"><div><h1>{view.title}</h1><p className="muted">{view.scheduledDate || t('portal.common.dateNotSet')} · {translatePortalJobStatus(t, view.status)}</p></div>{view.mode === 'cancelled' ? <span className="badge">{t('portal.contractor.cancelled')}</span> : null}{view.mode === 'completed' ? <span className="badge">{t('portal.contractor.completed')}</span> : null}</header>
      <div className="contractor-job-packet-details"><p className="eyebrow">{c.jobDetails}</p>{view.address ? <div className="contractor-job-block"><strong>{t('portal.contractor.address')}</strong><p className="muted">{view.address}</p><a className="btn contractor-map-button" href={`https://maps.google.com/?q=${encodeURIComponent(view.address)}`} target="_blank" rel="noreferrer">{t('portal.contractor.maps')}</a></div> : null}{view.instructions ? <div className="contractor-job-block contractor-instructions"><strong>{t('portal.contractor.instructions')}</strong><p className="muted">{view.instructions}</p></div> : null}{view.customerName ? <div className="contractor-job-block"><strong>{t('portal.contractor.customer')}</strong><p className="muted">{view.customerName}</p></div> : null}{view.phone ? <div className="contractor-job-block"><strong>{t('portal.contractor.contact')}</strong><p className="muted"><a href={`tel:${view.phone}`}>{view.phone}</a></p></div> : null}</div>
      {view.mode === 'active' ? <div className="contractor-field-actions">{!isInProgress ? <button type="button" className="btn btn-primary contractor-primary-field-action" disabled={updating} onClick={() => void updateJobStatus('active')}>{updating ? c.updating : c.start}</button> : null}{isInProgress ? <><p className="eyebrow">{c.photos}</p><input ref={photoInputRef} type="file" accept="image/*" capture="environment" hidden onChange={event => void uploadPhoto(event.target.files?.[0])} /><div className="contractor-photo-actions"><button type="button" className="btn" disabled={uploadingPhoto} onClick={() => choosePhoto('before')}>{c.addBefore}</button><button type="button" className="btn" disabled={uploadingPhoto} onClick={() => choosePhoto('after')}>{c.addAfter}</button></div>{uploadingPhoto ? <p className="muted">{c.uploading}</p> : null}{photoMessage ? <p className="muted" role="status">{photoMessage}</p> : null}<p className="eyebrow contractor-finish-label">{c.finish}</p><button type="button" className="btn btn-primary contractor-primary-field-action" disabled={updating} onClick={() => void updateJobStatus('completed')}>{updating ? c.updating : c.complete}</button></> : null}{actionError ? <p className="auth-message auth-message-error" role="alert">{actionError}</p> : null}</div> : null}
      <footer className="contractor-job-pay">{view.payAmount != null ? <><strong>{t('portal.contractor.yourPay')}</strong><p className="portal-finance-amount">{formatContractorMoney(view.payAmount)}{view.paymentStatus ? ` · ${translatePortalPaymentStatus(t, view.paymentStatus)}` : ''}</p></> : <><strong>{t('portal.contractor.yourPay')}</strong><p className="portal-finance-empty">{t('portal.contractor.payNotRecorded')}</p></>}</footer>
    </section> : null}
  </div>;
}
