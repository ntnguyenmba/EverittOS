'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { appUrl } from '@/lib/app-url';
import { limitsForPlan } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { JobEmailComposer } from '@/components/job-email-composer';
import { useTranslation } from '@/components/locale-provider';
import { supabase } from '@/lib/supabase';

type AccessRow = { client_user_id: string; portal_token: string | null; granted_at: string | null; email: string | null };
type Props = { jobId: string; plan: EverittosPlan; canManage: boolean; customerName?: string | null; customerEmail?: string | null; onCustomerEmailChange?: (email: string) => void; onSaveCustomerEmail?: (email: string) => Promise<boolean> | boolean };

export function ClientAccessPanel({ jobId, plan, canManage, customerName = null, customerEmail = null, onCustomerEmailChange, onSaveCustomerEmail }: Props) {
  const { locale } = useTranslation();
  const copy = {
    en: {
      scheduleChange: 'Schedule change', loadError: 'Unable to load customer portal status.', enableError: 'Unable to enable customer access.',
      enabled: 'Customer access enabled.', portalEnableError: 'Unable to enable customer portal access.', updated: 'Updated.',
      disableError: 'Unable to turn off customer portal access.', linkUnavailable: 'The portal link is not available yet.',
      linkCopied: 'Portal link copied.', copyError: 'Unable to copy the portal link.', there: 'there',
      reviewBody: (name: string, url: string) => `Hi ${name},\n\nThank you for choosing us. If you have a moment, we would appreciate your review:\n${url}\n\nThank you.`,
      assigned: 'Job assigned', assignedSubject: 'Job assigned', assignedBody: (name: string) => `Hi ${name},\n\nYou have been assigned to this job. Please reply to this email if you have any questions.`,
      scheduleSubject: 'Job schedule change', scheduleBody: (name: string) => `Hi ${name},\n\nThe schedule for this job has changed. Please check the job details and reply to confirm.`,
      needPhotos: 'Need photos', photosSubject: 'Photos needed for job', photosBody: (name: string) => `Hi ${name},\n\nPlease upload the required job photos when you are on site. Reply here if you have any questions.`,
      workerEmail: 'Worker email', emailWorker: 'Email worker', customerReview: 'Customer review',
      addEmailReview: 'Add a customer email before asking for a review.', addReviewLink: 'Add your Google, Facebook, or website review link before sending.',
      setReviewLink: 'Set review link', askReview: 'Ask for review', reviewSubject: 'Thank you for choosing us',
      portal: 'Customer portal', planRequired: 'Customer portal access requires the Growth plan or higher.', checking: 'Checking customer access…',
      accessEnabled: 'Customer access enabled', customer: 'Customer', canView: 'can view this job online.', emailOnFile: copy.emailOnFile,
      copyLink: 'Copy portal link', updating: 'Updating…', turnOff: 'Turn off access', notEnabled: 'Customer access not enabled',
      enabling: 'Enabling…', enable: 'Enable customer access', noEmail: 'No customer email available',
      noEmailHelp: 'Add a customer email later if you want to enable portal access. This does not block the job.',
      emailPlaceholder: 'Customer email', addEmailEnable: 'Add email and enable access'
    },
    es: {
      scheduleChange: 'Cambio de horario', loadError: 'No se pudo cargar el estado del portal del cliente.', enableError: 'No se pudo habilitar el acceso del cliente.',
      enabled: 'Acceso del cliente habilitado.', portalEnableError: 'No se pudo habilitar el portal del cliente.', updated: 'Actualizado.',
      disableError: 'No se pudo desactivar el acceso al portal.', linkUnavailable: 'El enlace del portal aún no está disponible.',
      linkCopied: 'Enlace del portal copiado.', copyError: 'No se pudo copiar el enlace del portal.', there: 'hola',
      reviewBody: (name: string, url: string) => `Hola ${name}:\n\nGracias por elegirnos. Si tiene un momento, agradeceríamos su reseña:\n${url}\n\nGracias.`,
      assigned: 'Trabajo asignado', assignedSubject: 'Trabajo asignado', assignedBody: (name: string) => `Hola ${name}:\n\nSe le ha asignado este trabajo. Responda a este correo si tiene alguna pregunta.`,
      scheduleSubject: 'Cambio de horario del trabajo', scheduleBody: (name: string) => `Hola ${name}:\n\nEl horario de este trabajo cambió. Revise los detalles y responda para confirmar.`,
      needPhotos: 'Se necesitan fotos', photosSubject: 'Fotos necesarias para el trabajo', photosBody: (name: string) => `Hola ${name}:\n\nSuba las fotos necesarias cuando esté en el lugar. Responda aquí si tiene preguntas.`,
      workerEmail: 'Correo del trabajador', emailWorker: 'Enviar correo al trabajador', customerReview: 'Reseña del cliente',
      addEmailReview: 'Agregue el correo del cliente antes de pedir una reseña.', addReviewLink: 'Agregue su enlace de reseñas de Google, Facebook o sitio web antes de enviar.',
      setReviewLink: 'Configurar enlace de reseña', askReview: 'Pedir reseña', reviewSubject: 'Gracias por elegirnos',
      portal: 'Portal del cliente', planRequired: 'El acceso al portal requiere el plan Growth o superior.', checking: 'Verificando acceso del cliente…',
      accessEnabled: 'Acceso del cliente habilitado', customer: 'Cliente', canView: 'puede ver este trabajo en línea.', emailOnFile: 'Correo registrado',
      copyLink: 'Copiar enlace del portal', updating: 'Actualizando…', turnOff: 'Desactivar acceso', notEnabled: 'Acceso del cliente no habilitado',
      enabling: 'Habilitando…', enable: 'Habilitar acceso del cliente', noEmail: 'No hay correo del cliente',
      noEmailHelp: 'Agregue un correo más adelante si desea habilitar el portal. Esto no bloquea el trabajo.',
      emailPlaceholder: 'Correo del cliente', addEmailEnable: 'Agregar correo y habilitar acceso'
    },
    vi: {
      scheduleChange: 'Thay đổi lịch', loadError: 'Không thể tải trạng thái cổng khách hàng.', enableError: 'Không thể bật quyền truy cập khách hàng.',
      enabled: 'Đã bật quyền truy cập khách hàng.', portalEnableError: 'Không thể bật cổng khách hàng.', updated: 'Đã cập nhật.',
      disableError: 'Không thể tắt quyền truy cập cổng khách hàng.', linkUnavailable: 'Liên kết cổng chưa khả dụng.',
      linkCopied: 'Đã sao chép liên kết cổng.', copyError: 'Không thể sao chép liên kết cổng.', there: 'bạn',
      reviewBody: (name: string, url: string) => `Xin chào ${name},\n\nCảm ơn bạn đã chọn chúng tôi. Nếu có thời gian, chúng tôi rất mong nhận được đánh giá của bạn:\n${url}\n\nXin cảm ơn.`,
      assigned: 'Đã giao công việc', assignedSubject: 'Đã giao công việc', assignedBody: (name: string) => `Xin chào ${name},\n\nBạn đã được giao công việc này. Vui lòng trả lời email nếu có câu hỏi.`,
      scheduleSubject: 'Thay đổi lịch công việc', scheduleBody: (name: string) => `Xin chào ${name},\n\nLịch của công việc này đã thay đổi. Hãy kiểm tra chi tiết và trả lời để xác nhận.`,
      needPhotos: 'Cần ảnh', photosSubject: 'Cần ảnh công việc', photosBody: (name: string) => `Xin chào ${name},\n\nVui lòng tải lên ảnh công việc cần thiết khi bạn đến nơi. Hãy trả lời nếu có câu hỏi.`,
      workerEmail: 'Email nhân viên', emailWorker: 'Gửi email cho nhân viên', customerReview: 'Đánh giá của khách hàng',
      addEmailReview: 'Thêm email khách hàng trước khi yêu cầu đánh giá.', addReviewLink: 'Thêm liên kết đánh giá Google, Facebook hoặc trang web trước khi gửi.',
      setReviewLink: 'Đặt liên kết đánh giá', askReview: 'Yêu cầu đánh giá', reviewSubject: 'Cảm ơn bạn đã chọn chúng tôi',
      portal: 'Cổng khách hàng', planRequired: 'Quyền truy cập cổng khách hàng cần gói Growth trở lên.', checking: 'Đang kiểm tra quyền truy cập…',
      accessEnabled: 'Đã bật quyền truy cập khách hàng', customer: 'Khách hàng', canView: 'có thể xem công việc này trực tuyến.', emailOnFile: 'Email đã lưu',
      copyLink: 'Sao chép liên kết cổng', updating: 'Đang cập nhật…', turnOff: 'Tắt quyền truy cập', notEnabled: 'Chưa bật quyền truy cập khách hàng',
      enabling: 'Đang bật…', enable: 'Bật quyền truy cập khách hàng', noEmail: 'Chưa có email khách hàng',
      noEmailHelp: 'Thêm email khách hàng sau nếu muốn bật cổng. Việc này không chặn công việc.',
      emailPlaceholder: 'Email khách hàng', addEmailEnable: 'Thêm email và bật quyền truy cập'
    }
  }[locale];
  const [emailDraft, setEmailDraft] = useState(customerEmail || '');
  const [accessRows, setAccessRows] = useState<AccessRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [jobCompleted, setJobCompleted] = useState(false);
  const [reviewUrl, setReviewUrl] = useState('');
  const [workerEmail, setWorkerEmail] = useState('');
  const [workerName, setWorkerName] = useState('');
  const portalAllowed = limitsForPlan(plan).clientPortal;
  const normalizedCustomerEmail = (customerEmail || '').trim();

  const loadAccess = useCallback(async () => {
    setLoadingAccess(true);
    try {
      const res = await fetch(`/api/clients/access-status?jobId=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
      const json = (await res.json()) as { access?: AccessRow[]; error?: string };
      if (!res.ok) { setAccessRows([]); setMessage(json.error || copy.loadError); return; }
      setAccessRows(json.access || []);
    } catch { setAccessRows([]); setMessage(copy.loadError); }
    finally { setLoadingAccess(false); }
  }, [copy.loadError, jobId]);

  useEffect(() => { setEmailDraft(customerEmail || ''); }, [customerEmail]);
  useEffect(() => { if (portalAllowed) void loadAccess(); }, [loadAccess, portalAllowed]);
  useEffect(() => {
    if (!canManage) return;
    void (async () => {
      const [settingsRes, { data: jobRow }] = await Promise.all([
        fetch('/api/settings/reviews', { cache: 'no-store' }),
        supabase.from('jobs').select('status, assigned_to, assigned_email').eq('id', jobId).maybeSingle()
      ]);
      const settings = (await settingsRes.json().catch(() => ({}))) as { reviewUrl?: string };
      if (settingsRes.ok) setReviewUrl(settings.reviewUrl || '');
      setJobCompleted(jobRow?.status === 'completed');
      let email = String(jobRow?.assigned_email || '').trim();
      let name = '';
      if (jobRow?.assigned_to) {
        const { data: worker } = await supabase.from('workers').select('name, email').eq('id', jobRow.assigned_to).maybeSingle();
        email = String(worker?.email || email).trim();
        name = String(worker?.name || '').trim();
      }
      setWorkerEmail(email); setWorkerName(name);
    })();
  }, [canManage, jobId]);

  async function grantAccess(emailValue: string) {
    if (!emailValue.trim() || busy) return; setBusy(true); setMessage('');
    try { const res = await fetch('/api/clients/grant-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailValue.trim(), jobId }) }); const json = await res.json(); if (!res.ok) { setMessage(json.error || copy.enableError); return; } setMessage(json.message || copy.enabled); await loadAccess(); }
    catch { setMessage(copy.portalEnableError); } finally { setBusy(false); }
  }
  async function revokeAccess(clientUserId: string) { if (busy) return; setBusy(true); setMessage(''); try { const res = await fetch('/api/clients/revoke-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, clientUserId }) }); const json = await res.json(); setMessage(json.message || json.error || copy.updated); if (res.ok) await loadAccess(); } catch { setMessage(copy.disableError); } finally { setBusy(false); } }
  async function copyLink(token: string | null) { if (!token) { setMessage(copy.linkUnavailable); return; } try { await navigator.clipboard.writeText(appUrl(`/portal/client?token=${token}`)); setMessage(copy.linkCopied); } catch { setMessage(copy.copyError); } }
  async function saveEmailAndEnable() { if (!canManage || busy) return; const nextEmail = emailDraft.trim(); onCustomerEmailChange?.(nextEmail); if (onSaveCustomerEmail && !(await onSaveCustomerEmail(nextEmail))) return; await grantAccess(nextEmail); }

  const primaryAccess = accessRows.find((row) => (row.email || '').toLowerCase() === normalizedCustomerEmail.toLowerCase()) || accessRows[0] || null;
  const reviewBody = copy.reviewBody(customerName || copy.there, reviewUrl);
  const workerTemplates = [
    { label: copy.assigned, subject: copy.assignedSubject, body: copy.assignedBody(workerName || copy.there) },
    { label: copy.scheduleChange, subject: copy.scheduleSubject, body: copy.scheduleBody(workerName || copy.there) },
    { label: copy.needPhotos, subject: copy.photosSubject, body: copy.photosBody(workerName || copy.there) }
  ];

  return <div>
    {canManage && workerEmail ? <div style={{ marginBottom: 18 }}><h3 style={{ marginTop: 0 }}>{copy.workerEmail}</h3><JobEmailComposer buttonLabel={copy.emailWorker} recipientEmail={workerEmail} recipientName={workerName} jobId={jobId} docType="message" defaultSubject={workerTemplates[0].subject} defaultBody={workerTemplates[0].body} templates={workerTemplates} metadata={{ recipient_role: 'worker' }} /></div> : null}
    {canManage && jobCompleted ? <div style={{ marginBottom: 18 }}><h3 style={{ marginTop: 0 }}>{copy.customerReview}</h3>{!normalizedCustomerEmail ? <p className="muted">{copy.addEmailReview}</p> : !reviewUrl ? <><p className="muted">{copy.addReviewLink}</p><Link className="btn" href={`/settings/reviews?jobId=${encodeURIComponent(jobId)}`}>{copy.setReviewLink}</Link></> : <JobEmailComposer buttonLabel={copy.askReview} recipientEmail={normalizedCustomerEmail} recipientName={customerName} jobId={jobId} docType="review" defaultSubject={copy.reviewSubject} defaultBody={reviewBody} metadata={{ review_url: reviewUrl }} />}</div> : null}
    <h3 style={{ marginTop: 0 }}>{copy.portal}</h3>
    {!portalAllowed ? <p className="muted">{copy.planRequired}</p> : null}
    {portalAllowed && loadingAccess ? <p className="muted">{copy.checking}</p> : null}
    {portalAllowed && !loadingAccess && primaryAccess ? <div className="list-row"><div><strong>{copy.accessEnabled}</strong><p className="muted" style={{ margin: '4px 0 0' }}>{customerName || copy.customer} {copy.canView}</p><p className="muted" style={{ margin: '4px 0 0' }}>{primaryAccess.email || normalizedCustomerEmail || copy.emailOnFile}</p></div><div className="inline-actions"><button type="button" className="btn" disabled={!primaryAccess.portal_token} onClick={() => void copyLink(primaryAccess.portal_token)}>{copy.copyLink}</button>{canManage ? <button type="button" className="btn" disabled={busy} onClick={() => void revokeAccess(primaryAccess.client_user_id)}>{busy ? copy.updating : copy.turnOff}</button> : null}</div></div> : null}
    {portalAllowed && !loadingAccess && !primaryAccess && normalizedCustomerEmail ? <div><strong>{copy.notEnabled}</strong><p className="muted" style={{ marginTop: 6 }}>{normalizedCustomerEmail}</p>{canManage ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void grantAccess(normalizedCustomerEmail)}>{busy ? copy.enabling : copy.enable}</button> : null}</div> : null}
    {portalAllowed && !loadingAccess && !primaryAccess && !normalizedCustomerEmail ? <div><strong>{copy.noEmail}</strong><p className="muted">{copy.noEmailHelp}</p>{canManage ? <div className="inline-actions"><input className="input" type="email" placeholder={copy.emailPlaceholder} value={emailDraft} onChange={(event) => { setEmailDraft(event.target.value); onCustomerEmailChange?.(event.target.value); }} /><button type="button" className="btn btn-primary" disabled={busy || !emailDraft.trim()} onClick={() => void saveEmailAndEnable()}>{busy ? copy.enabling : copy.addEmailEnable}</button></div> : null}</div> : null}
    {message ? <p>{message}</p> : null}
  </div>;
}
