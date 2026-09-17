'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ContactLink } from '@/components/contact-link';
import { CustomerLogo } from '@/components/customer-logo';
import { RecordSharingPanel } from '@/components/record-sharing-panel';
import { CustomerPropertiesPanel } from '@/components/customer-properties-panel';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { fetchOrganizationContext } from '@/lib/organization';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { customerDisplayAddress, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { uploadCustomerLogo } from '@/lib/customer-logo';
import { useTeamOptions } from '@/lib/team-options-client';
import { supabase } from '@/lib/supabase';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { customerStageLabel, getCustomerLifecycleCopy } from '@/lib/i18n/customer-lifecycle-copy';
import { canAccessWorkspaceRecord } from '@/lib/workspace-record-access';
import { ensureOrganizationForUser } from '@/lib/workspace-client';

type PageProps = { params: Promise<{ id: string }> };

const CUSTOMER_STAGE_VALUES = ['active', 'past', 'recurring', 'inactive', 'former', 'archived'] as const;

const customerDetailCopy = {
  en: {
    moveToLeads: 'Move to leads', moveToLeadsConfirm: 'Move this customer back to Leads?', archiveConfirm: 'Archive this customer?',
    setupError: 'Your account is still setting up. Refresh and try again.', logoUploadError: 'Logo upload failed.', logoSaveError: 'Logo could not be saved.',
    saveError: 'Unable to save customer.', moveError: 'Unable to move customer back to leads.', similarJobError: 'Unable to create a similar job.',
    loading: 'Loading…', back: 'Back', call: 'Call', text: 'Text', maps: 'Maps', newJob: 'New job',
    email: 'Email', phone: 'Phone', notOnFile: 'Not on file', serviceAddress: 'Service address', billingAddress: 'Billing address',
    details: 'Customer details', companyName: 'Company / client name', contactName: 'Contact name', emailAddress: 'Email address',
    phoneNumber: 'Phone number', preferredContact: 'Preferred contact method', notSet: 'Not set', any: 'Any',
    assignTo: 'Assign to', unassigned: 'Unassigned', status: 'Status', notes: 'Notes', logo: 'Logo', uploading: 'Uploading…', save: 'Save',
    jobs: 'Jobs', noJobs: 'No jobs yet.', creating: 'Creating…', bookAgain: 'Book again', sharing: 'Sharing',
    reports: 'Reports', noReports: 'No reports yet.', portalAccess: 'Customer dashboard access',
    portalPlan: 'Available on Growth and higher plans.', noPortalAccess: 'No portal access yet.', remove: 'Remove', more: 'More',
    archiveError: 'Unable to archive customer.'
  },
  es: {
    moveToLeads: 'Mover a prospectos', moveToLeadsConfirm: '¿Mover este cliente de nuevo a Prospectos?', archiveConfirm: '¿Archivar este cliente?',
    setupError: 'Su cuenta aún se está configurando. Actualice e inténtelo de nuevo.', logoUploadError: 'No se pudo subir el logotipo.', logoSaveError: 'No se pudo guardar el logotipo.',
    saveError: 'No se pudo guardar el cliente.', moveError: 'No se pudo mover el cliente a prospectos.', similarJobError: 'No se pudo crear un trabajo similar.',
    loading: 'Cargando…', back: 'Volver', call: 'Llamar', text: 'Mensaje', maps: 'Mapas', newJob: 'Nuevo trabajo',
    email: 'Correo', phone: 'Teléfono', notOnFile: 'No registrado', serviceAddress: 'Dirección de servicio', billingAddress: 'Dirección de facturación',
    details: 'Detalles del cliente', companyName: 'Nombre de empresa / cliente', contactName: 'Nombre de contacto', emailAddress: 'Correo electrónico',
    phoneNumber: 'Número de teléfono', preferredContact: 'Método de contacto preferido', notSet: 'No establecido', any: 'Cualquiera',
    assignTo: 'Asignar a', unassigned: 'Sin asignar', status: 'Estado', notes: 'Notas', logo: 'Logotipo', uploading: 'Subiendo…', save: 'Guardar',
    jobs: 'Trabajos', noJobs: 'Aún no hay trabajos.', creating: 'Creando…', bookAgain: 'Reservar de nuevo', sharing: 'Compartir',
    reports: 'Informes', noReports: 'Aún no hay informes.', portalAccess: 'Acceso al portal del cliente',
    portalPlan: 'Disponible en los planes Growth y superiores.', noPortalAccess: 'Aún no hay acceso al portal.', remove: 'Eliminar', more: 'Más',
    archiveError: 'No se pudo archivar el cliente.'
  },
  vi: {
    moveToLeads: 'Chuyển sang tiềm năng', moveToLeadsConfirm: 'Chuyển khách hàng này trở lại Tiềm năng?', archiveConfirm: 'Lưu trữ khách hàng này?',
    setupError: 'Tài khoản của bạn vẫn đang được thiết lập. Hãy tải lại và thử lại.', logoUploadError: 'Tải logo thất bại.', logoSaveError: 'Không thể lưu logo.',
    saveError: 'Không thể lưu khách hàng.', moveError: 'Không thể chuyển khách hàng về nhóm tiềm năng.', similarJobError: 'Không thể tạo công việc tương tự.',
    loading: 'Đang tải…', back: 'Quay lại', call: 'Gọi', text: 'Nhắn tin', maps: 'Bản đồ', newJob: 'Công việc mới',
    email: 'Email', phone: 'Điện thoại', notOnFile: 'Chưa có', serviceAddress: 'Địa chỉ dịch vụ', billingAddress: 'Địa chỉ thanh toán',
    details: 'Chi tiết khách hàng', companyName: 'Tên công ty / khách hàng', contactName: 'Tên liên hệ', emailAddress: 'Địa chỉ email',
    phoneNumber: 'Số điện thoại', preferredContact: 'Cách liên hệ ưu tiên', notSet: 'Chưa đặt', any: 'Bất kỳ',
    assignTo: 'Giao cho', unassigned: 'Chưa giao', status: 'Trạng thái', notes: 'Ghi chú', logo: 'Logo', uploading: 'Đang tải lên…', save: 'Lưu',
    jobs: 'Công việc', noJobs: 'Chưa có công việc.', creating: 'Đang tạo…', bookAgain: 'Đặt lại', sharing: 'Chia sẻ',
    reports: 'Báo cáo', noReports: 'Chưa có báo cáo.', portalAccess: 'Quyền truy cập trang khách hàng',
    portalPlan: 'Có trên gói Growth trở lên.', noPortalAccess: 'Chưa có quyền truy cập trang khách hàng.', remove: 'Xóa', more: 'Thêm',
    archiveError: 'Không thể lưu trữ khách hàng.'
  }
} as const;

export default function CustomerDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const copy = customerDetailCopy[locale];
  const lifecycle = getCustomerLifecycleCopy(locale);
  const { teamOptions, teamOptionsLoading } = useTeamOptions();
  const [customerId, setCustomerId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [canEdit, setCanEdit] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [pipelineStage, setPipelineStage] = useState('active');
  const [jobs, setJobs] = useState<
    {
      id: string;
      title: string;
      status: string | null;
      property_id?: string | null;
      scheduled_start?: string | null;
      start_date?: string | null;
      completed_at?: string | null;
      created_at?: string | null;
    }[]
  >([]);
  const [reports, setReports] = useState<{ id: string; title: string; job_id: string }[]>([]);
  const [portalAccess, setPortalAccess] = useState<
    { job_id: string; client_user_id: string; portal_token: string | null; profiles?: { email: string | null } | null }[]
  >([]);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [duplicatingJobId, setDuplicatingJobId] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [movingToLead, setMovingToLead] = useState(false);
  const [loading, setLoading] = useState(true);
  const appFeedback = useAppFeedback();

  useEffect(() => {
    params.then((p) => setCustomerId(p.id));
  }, [params]);

  async function load() {
    if (!customerId) return;
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const [{ data: profile }, org] = await Promise.all([
      supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
      fetchOrganizationContext(user.id)
    ]);
    const workspaceRole = normalizeRole(org?.role || profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setCanEdit(isManagerRole(workspaceRole));

    const { data: customer, error } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (error || !customer) {
      setLoading(false);
      appFeedback.error(error?.message || t('pages.customers.notFound'));
      return;
    }

    if (!canAccessWorkspaceRecord(customer, user.id, org?.organizationId, workspaceRole)) {
      setLoading(false);
      appFeedback.error(t('pages.customers.notFound'));
      return;
    }

    const customerRecord = customer as CustomerRecord;
    setDisplayName(customerDisplayName(customerRecord));
    setContactName(customerRecord.contact_name || customerDisplayName(customerRecord));
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    setAddress(customerDisplayAddress(customerRecord, ''));
    setBillingAddress(customerRecord.billing_address || customerDisplayAddress(customerRecord, ''));
    setPreferredContactMethod(customerRecord.preferred_contact_method || '');
    setNotes(customer.notes || '');
    setAssignedTo(customerRecord.assigned_to || '');
    setPipelineStage(customerRecord.pipeline_stage || 'active');
    setLogoPath(customerRecord.logo_path || null);

    const resolvedOrgId = org?.organizationId || customer.organization_id || '';
    setOrgId(resolvedOrgId);

    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id, title, status, property_id, scheduled_start, start_date, completed_at, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    const jobIds = (jobRows || []).map((j: { id: string }) => j.id);
    const { data: reportRows } = jobIds.length
      ? await supabase.from('job_reports').select('id, title, job_id').in('job_id', jobIds)
      : { data: [] };

    setJobs(jobRows || []);
    setReports(reportRows || []);

    if (jobIds.length) {
      const { data: accessRows } = await supabase
        .from('job_client_access')
        .select('job_id, client_user_id, portal_token, profiles:profiles(email)')
        .in('job_id', jobIds);
      setPortalAccess(
        (accessRows || []).map((row: {
          job_id: string;
          client_user_id: string;
          portal_token: string | null;
          profiles: { email: string | null } | { email: string | null }[] | null;
        }) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return {
            job_id: row.job_id as string,
            client_user_id: row.client_user_id as string,
            portal_token: (row.portal_token as string | null) || null,
            profiles: profile ? { email: (profile as { email: string | null }).email } : null
          };
        })
      );
    } else {
      setPortalAccess([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [customerId]);

  async function uploadLogo(file: File | null) {
    if (!file || !canEdit || !customerId) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const org = await ensureOrganizationForUser(user.id);
    if (!org?.organizationId) {
      appFeedback.error(copy.setupError);
      return;
    }

    setLogoUploading(true);
    const { path, error } = await uploadCustomerLogo(supabase, org.organizationId, customerId, file);
    if (error || !path) {
      setLogoUploading(false);
      appFeedback.error(error || copy.logoUploadError);
      return;
    }

    const logoRes = await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_path: path })
    });
    const logoJson = (await logoRes.json().catch(() => ({}))) as { error?: string };
    setLogoUploading(false);
    if (!logoRes.ok) {
      appFeedback.error(logoJson.error || copy.logoSaveError);
      return;
    }
    setLogoPath(path);
    appFeedback.uploadComplete();
  }

  async function saveCustomer() {
    if (!canEdit || !customerId || savingCustomer) return;
    setSavingCustomer(true);
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        contactName,
        phone,
        email,
        address,
        billingAddress,
        preferredContactMethod: preferredContactMethod || null,
        notes,
        assigned_to: assignedTo || null,
        pipeline_stage: pipelineStage,
        record_type: 'customer'
      })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSavingCustomer(false);
    if (!res.ok) {
      appFeedback.error(json.error || copy.saveError);
      return;
    }
    appFeedback.saved();
    load();
  }

  async function moveBackToLead() {
    if (!canEdit || !customerId || movingToLead) return;
    if (!window.confirm(copy.moveToLeadsConfirm)) return;
    setMovingToLead(true);
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_type: 'lead', pipeline_stage: 'reopened' })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setMovingToLead(false);
    if (!res.ok) {
      appFeedback.error(json.error || copy.moveError);
      return;
    }
    appFeedback.saved();
    router.push(`/leads/${customerId}`);
  }

  async function updateLifecycleStage(nextStage: 'active' | 'past' | 'archived') {
    if (!canEdit || !customerId || savingCustomer) return;
    setSavingCustomer(true);
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_type: 'customer', pipeline_stage: nextStage })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSavingCustomer(false);
    if (!res.ok) {
      appFeedback.error(json.error || lifecycle.messages.unableToUpdate);
      return;
    }
    setPipelineStage(nextStage);
    if (nextStage === 'past') appFeedback.success(lifecycle.messages.markedPast);
    else if (nextStage === 'active') appFeedback.success(lifecycle.messages.markedActive);
    else appFeedback.success(lifecycle.messages.restored);
    void load();
  }

  async function bookAgain(jobId: string) {
    setDuplicatingJobId(jobId);
    const res = await fetch(`/api/jobs/${jobId}/duplicate`, { method: 'POST' });
    const json = (await res.json().catch(() => ({}))) as { job?: { id: string }; redirectTo?: string; error?: string };
    setDuplicatingJobId(null);
    if (!res.ok || !json.job?.id) {
      appFeedback.error(json.error || copy.similarJobError);
      return;
    }
    router.push(json.redirectTo || `/jobs/${json.job.id}?confirmSchedule=1`);
  }

  if (loading) {
    return (
      <AppShell plan={plan}>
        <div className="card">{copy.loading}</div>
      </AppShell>
    );
  }

  return (
    <AppShell plan={plan}>
      <div className="page-head customer-card-row">
        <CustomerLogo logoPath={logoPath} alt={displayName} size={56} />
        <div>
          <h2>{displayName}</h2>
          <p className="muted">{customerStageLabel(pipelineStage, locale)}</p>
        </div>
        <Link className="btn" href="/customers">
          {copy.back}
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="button-row" style={{ flexWrap: 'wrap' }}>
          {phone ? (
            <a className="btn btn-primary" href={`tel:${phone}`}>
              {copy.call}
            </a>
          ) : null}
          {phone ? (
            <a className="btn" href={`sms:${phone}`}>
              {copy.text}
            </a>
          ) : null}
          {address ? (
            <a className="btn" href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
              {copy.maps}
            </a>
          ) : null}
          {canEdit ? (
            <Link className="btn" href={`/jobs/new?customerId=${customerId}`}>
              {copy.newJob}
            </Link>
          ) : null}
        </div>
        <div style={{ marginTop: 14 }}>
          {email ? (
            <p>
              <strong>{copy.email}:</strong> <ContactLink type="email" value={email} />
            </p>
          ) : (
            <p className="muted">{copy.email}: {copy.notOnFile}</p>
          )}
          {phone ? (
            <p>
              <strong>{copy.phone}:</strong> <ContactLink type="phone" value={phone} />
            </p>
          ) : (
            <p className="muted">{copy.phone}: {copy.notOnFile}</p>
          )}
          {address ? <p><strong>{copy.serviceAddress}:</strong> {address}</p> : null}
          {billingAddress ? <p><strong>{copy.billingAddress}:</strong> {billingAddress}</p> : null}
        </div>
      </div>

      <details className="card" style={{ marginBottom: 18 }}>
        <summary><strong>{copy.details}</strong></summary>
        <div className="form" style={{ marginTop: 16 }}>
          <label>{copy.companyName}</label>
          <input className="input" value={displayName} disabled={!canEdit} onChange={(e) => setDisplayName(e.target.value)} />
          <label htmlFor="customer-contact-name">{copy.contactName}</label>
          <input id="customer-contact-name" className="input" value={contactName} disabled={!canEdit} onChange={(e) => setContactName(e.target.value)} />
          <label htmlFor="customer-email">{copy.emailAddress}</label>
          <input id="customer-email" className="input" type="email" autoComplete="email" inputMode="email" value={email} disabled={!canEdit} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="customer-phone">{copy.phoneNumber}</label>
          <input id="customer-phone" className="input" type="tel" autoComplete="tel" inputMode="tel" value={phone} disabled={!canEdit} onChange={(e) => setPhone(e.target.value)} />
          <label htmlFor="preferred-contact">{copy.preferredContact}</label>
          <select
            id="preferred-contact"
            className="input"
            value={preferredContactMethod}
            disabled={!canEdit}
            onChange={(e) => setPreferredContactMethod(e.target.value)}
          >
            <option value="">{copy.notSet}</option>
            <option value="email">{copy.email}</option>
            <option value="phone">{copy.phone}</option>
            <option value="text">{copy.text}</option>
            <option value="any">{copy.any}</option>
          </select>
          <AddressAutocomplete
            id="customer-address"
            label={copy.serviceAddress}
            value={address}
            disabled={!canEdit}
            onChange={(formatted) => setAddress(formatted)}
          />
          <AddressAutocomplete
            id="customer-billing-address"
            label={copy.billingAddress}
            value={billingAddress}
            disabled={!canEdit}
            onChange={(formatted) => setBillingAddress(formatted)}
          />
          <label>{copy.assignTo}</label>
          <select className="input" value={assignedTo} disabled={!canEdit || teamOptionsLoading} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">{copy.unassigned}</option>
            {teamOptions.map((member) => (
              <option key={member.userId} value={member.userId}>{member.label} - {member.role}</option>
            ))}
          </select>
          <label>{copy.status}</label>
          <select className="input" value={pipelineStage} disabled={!canEdit} onChange={(e) => setPipelineStage(e.target.value)}>
            {CUSTOMER_STAGE_VALUES.map((stage) => (
              <option key={stage} value={stage}>{customerStageLabel(stage, locale)}</option>
            ))}
          </select>
          <label>{copy.notes}</label>
          <textarea className="input" rows={3} value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} />
          {canEdit ? (
            <>
              <label className="auth-field">
                <span>{copy.logo}</span>
                <input className="input" type="file" accept="image/png,image/jpeg,image/webp" disabled={logoUploading} onChange={(e) => void uploadLogo(e.target.files?.[0] || null)} />
              </label>
              {logoUploading ? <p className="loading-state" role="status">{copy.uploading}</p> : null}
              <button type="button" className="btn btn-primary" disabled={savingCustomer} onClick={() => void saveCustomer()}>
                {savingCustomer ? t('feedback.loading') : copy.save}
              </button>
            </>
          ) : null}
        </div>
      </details>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="dashboard-section-head">
          <h3>{copy.jobs}</h3>
          {canEdit ? <Link href={`/jobs/new?customerId=${customerId}`} className="dashboard-section-link">{copy.newJob}</Link> : null}
        </div>
        {jobs.length === 0 ? <p className="muted">{copy.noJobs}</p> : null}
        {jobs.map((job) => (
          <div key={job.id} className="list-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/jobs/${job.id}`}>{job.title}</Link>
            <span>{job.status}</span>
            {canEdit ? (
              <button
                type="button"
                className="btn"
                disabled={duplicatingJobId === job.id}
                onClick={() => void bookAgain(job.id)}
              >
                {duplicatingJobId === job.id ? copy.creating : copy.bookAgain}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <CustomerPropertiesPanel customerId={customerId} customerName={displayName} canEdit={canEdit} jobs={jobs} />

      {orgId ? (
        <details className="card" style={{ marginBottom: 18 }}>
          <summary><strong>{copy.sharing}</strong></summary>
          <div style={{ marginTop: 16 }}>
            <RecordSharingPanel organizationId={orgId} recordType="customer" recordId={customerId} canManage={canEdit} />
          </div>
        </details>
      ) : null}

      <details className="card" style={{ marginBottom: 18 }}>
        <summary><strong>{copy.reports}</strong></summary>
        <div style={{ marginTop: 16 }}>
          {reports.length === 0 ? <p className="muted">{copy.noReports}</p> : null}
          {reports.map((report) => (
            <div key={report.id} className="list-row">
              <Link href={`/jobs/${report.job_id}/report`}>{report.title}</Link>
            </div>
          ))}
        </div>
      </details>

      <details className="card" style={{ marginBottom: 18 }}>
        <summary><strong>{copy.portalAccess}</strong></summary>
        <div style={{ marginTop: 16 }}>
          {!limitsForPlan(plan).clientPortal ? (
            <p className="muted">{copy.portalPlan}</p>
          ) : portalAccess.length === 0 ? (
            <p className="muted">{copy.noPortalAccess}</p>
          ) : (
            portalAccess.map((row) => (
              <div key={`${row.job_id}-${row.client_user_id}`} className="list-row">
                <div>
                  <strong>{row.profiles?.email || row.client_user_id}</strong>
                  <p className="muted">{jobs.find((job) => job.id === row.job_id)?.title || row.job_id}</p>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      await fetch('/api/clients/revoke-access', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jobId: row.job_id, clientUserId: row.client_user_id })
                      });
                      load();
                    }}
                  >
                    {copy.remove}
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </details>

      {canEdit ? (
        <details className="card">
          <summary><strong>{copy.more}</strong></summary>
          <div className="button-row" style={{ marginTop: 16, flexWrap: 'wrap' }}>
            {pipelineStage !== 'active' ? <button type="button" className="btn" disabled={savingCustomer} onClick={() => void updateLifecycleStage('active')}>{lifecycle.actions.markActive}</button> : null}
            {pipelineStage !== 'past' ? <button type="button" className="btn" disabled={savingCustomer} onClick={() => void updateLifecycleStage('past')}>{lifecycle.actions.markPast}</button> : null}
            {pipelineStage === 'archived' ? <button type="button" className="btn" disabled={savingCustomer} onClick={() => void updateLifecycleStage('active')}>{lifecycle.actions.restore}</button> : null}
            <button type="button" className="btn" disabled={movingToLead} onClick={() => void moveBackToLead()}>{movingToLead ? t('feedback.loading') : copy.moveToLeads}</button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                if (!window.confirm(copy.archiveConfirm)) return;
                const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
                const json = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                  appFeedback.error(json.error || copy.archiveError);
                  return;
                }
                appFeedback.deleted();
                router.push('/customers?stage=archived');
              }}
            >
              {lifecycle.actions.archive}
            </button>
          </div>
        </details>
      ) : null}
    </AppShell>
  );
}
