'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ContactLink } from '@/components/contact-link';
import { CustomerLogo } from '@/components/customer-logo';
import { ExportMenu } from '@/components/export-menu';
import { useTranslation } from '@/components/locale-provider';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { formatSupabaseError } from '@/lib/action-messages';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { filterDemoSeedCustomers } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { validatePlanAction } from '@/lib/plan-validate';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import {
  CUSTOMER_LIST_SELECT,
  customerDisplayAddress,
  customerDisplayName,
  type CustomerRecord
} from '@/lib/customer-record';
import { uploadCustomerLogo } from '@/lib/customer-logo';
import {
  customerStageLabel,
  getCustomerLifecycleCopy
} from '@/lib/i18n/customer-lifecycle-copy';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { monthStartIso } from '@/lib/date-filters';
import { supabase } from '@/lib/supabase';
import { RecordActions } from '@/components/record-actions';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';

const CUSTOMER_PAGE_SIZE = 10;

function CustomersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodFilter = searchParams.get('period');
  const stageFilter = searchParams.get('stage') || searchParams.get('status');
  const { t, locale } = useTranslation();
  const copy = {
    en: { edit: 'Edit', quickAdd: 'Quick add customer', openJobs: 'Open jobs', showMore: 'Show 10 more', showing: 'Showing' },
    es: { edit: 'Editar', quickAdd: 'Agregar cliente rápido', openJobs: 'Trabajos abiertos', showMore: 'Mostrar 10 más', showing: 'Mostrando' },
    vi: { edit: 'Sửa', quickAdd: 'Thêm khách nhanh', openJobs: 'Công việc đang mở', showMore: 'Hiển thị thêm 10', showing: 'Đang hiển thị' }
  }[locale];
  const lifecycle = getCustomerLifecycleCopy(locale);
  const exportCopy = getExportCopy(locale);
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [openJobCounts, setOpenJobCounts] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState(CUSTOMER_PAGE_SIZE);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [role, setRole] = useState(normalizeRole('owner'));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  async function load() {
    setLoading(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const org = await fetchOrganizationContext(user.id);
    const workspaceRole = normalizeRole(org?.role || profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(workspaceRole);
    setCanManage(isManagerRole(workspaceRole));

    let query = supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .order('created_at', { ascending: false });
    if (org?.organizationId) query = query.eq('organization_id', org.organizationId);
    else query = query.eq('user_id', user.id);

    if (periodFilter === 'month') query = query.gte('created_at', monthStartIso());
    if (stageFilter === 'lead' || stageFilter === 'leads') {
      query = query.or('record_type.eq.lead,pipeline_stage.in.(lead,qualified,open,contacted,quoted)');
    } else if (stageFilter === 'archived') {
      query = query.eq('pipeline_stage', 'archived');
    } else if (stageFilter === 'active') {
      query = query.eq('record_type', 'customer').eq('pipeline_stage', 'active');
    } else if (stageFilter === 'past' || stageFilter === 'inactive' || stageFilter === 'former') {
      query = query.eq('record_type', 'customer').in('pipeline_stage', ['past', 'inactive', 'former']);
    } else {
      query = query.eq('record_type', 'customer').neq('pipeline_stage', 'archived');
    }

    const [{ data, error }, orgIsDemo] = await Promise.all([
      query,
      fetchOrganizationIsDemo(supabase, org?.organizationId)
    ]);

    if (error) {
      setLoading(false);
      appFeedback.error(formatSupabaseError(error));
      return;
    }

    const visibleCustomers = filterDemoSeedCustomers(data || [], orgIsDemo);
    setCustomers(visibleCustomers);
    setVisibleCount(CUSTOMER_PAGE_SIZE);

    const ids = visibleCustomers.map((customer) => customer.id).filter(Boolean);
    if (ids.length) {
      let jobsQuery = supabase
        .from('jobs')
        .select('customer_id, status')
        .in('customer_id', ids);
      if (org?.organizationId) jobsQuery = jobsQuery.eq('organization_id', org.organizationId);
      else jobsQuery = jobsQuery.eq('user_id', user.id);
      const { data: jobRows } = await jobsQuery;
      const counts: Record<string, number> = {};
      for (const row of jobRows || []) {
        const status = String(row.status || '').toLowerCase();
        if (['completed', 'finished', 'cancelled', 'canceled'].includes(status)) continue;
        const customerId = String(row.customer_id || '');
        if (!customerId) continue;
        counts[customerId] = (counts[customerId] || 0) + 1;
      }
      setOpenJobCounts(counts);
    } else {
      setOpenJobCounts({});
    }

    setLoading(false);
  }

  function onLogoSelected(file: File | null) {
    setLogoFile(file);
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function addCustomer() {
    if (!displayName.trim()) {
      appFeedback.error('Enter a customer name first.');
      return;
    }
    if (saving) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/customers');
      return;
    }

    setSaving(true);
    const workspace = await ensureWorkspaceForSave(user.id);
    if (!workspace.ok) {
      setSaving(false);
      appFeedback.error(workspace.error);
      return;
    }
    const org = workspace.workspace;

    const { plan: orgPlan } = await resolveOrganizationPlan(supabase, user.id);
    const usage = await fetchUsageCounts(user.id, org.organizationId);
    const check = validatePlanAction({ plan: orgPlan, resource: 'customers', currentCount: usage.customers });
    if (!check.allowed) {
      setSaving(false);
      appFeedback.error(check.message || limitMessage('customers', orgPlan));
      return;
    }

    const serverCheck = await fetch('/api/plan/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'customers' })
    });
    const serverJson = await serverCheck.json();
    if (!serverJson.allowed) {
      setSaving(false);
      appFeedback.error(serverJson.message || 'Plan limit reached.');
      return;
    }

    const createRes = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, phone, email, address, notes })
    });
    const createJson = (await createRes.json()) as { customer?: { id: string }; error?: string };
    if (!createRes.ok) {
      setSaving(false);
      appFeedback.error(createJson.error || 'Unable to save customer.');
      return;
    }

    const createdCustomer = createJson.customer;
    if (logoFile && createdCustomer?.id) {
      const { path, error: uploadError } = await uploadCustomerLogo(supabase, org.organizationId, createdCustomer.id, logoFile);
      if (uploadError) {
        setSaving(false);
        appFeedback.error(`Customer saved, but logo upload failed: ${uploadError}`);
        load();
        return;
      }
      if (path) {
        const logoRes = await fetch(`/api/customers/${createdCustomer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo_path: path })
        });
        if (!logoRes.ok) {
          const logoJson = (await logoRes.json().catch(() => ({}))) as { error?: string };
          setSaving(false);
          appFeedback.error(`Customer saved, but logo could not be linked: ${logoJson.error || 'Update failed.'}`);
          load();
          return;
        }
      }
    }

    setSaving(false);
    appFeedback.created();
    setDisplayName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    onLogoSelected(null);
    load();
  }

  useEffect(() => {
    load();
  }, [periodFilter, stageFilter]);

  const visibleCustomers = customers.slice(0, visibleCount);
  const hasMore = visibleCount < customers.length;

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title={t('nav.crm')}
        subtitle={t('ux.pageTitles.customers')}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {isManagerRole(role) ? <Link className="btn" href="/customers/import">Import CSV</Link> : null}
            {isManagerRole(role) ? (
              <ExportMenu endpoint="/api/exports/customers" query={{ period: periodFilter, stage: stageFilter }} locale={locale} disabled={loading} onError={(message) => appFeedback.error(message || exportCopy.exportFailed)} onSuccess={(format) => { if (format === 'share') appFeedback.success(exportCopy.shareSent); }} />
            ) : null}
            {canManage ? <Link className="btn btn-primary" href="/customers/new">Add customer</Link> : null}
          </div>
        }
      />

      <div className="job-detail-actions" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        {([
          { id: 'customers', label: lifecycle.filters.customers, href: '/customers' },
          { id: 'leads', label: lifecycle.filters.leads, href: '/customers?stage=leads' },
          { id: 'archived', label: lifecycle.filters.archived, href: '/customers?stage=archived' }
        ] as const).map((filter) => {
          const active = filter.id === 'customers' ? !stageFilter || stageFilter === 'customers' : stageFilter === filter.id || (filter.id === 'leads' && (stageFilter === 'lead' || stageFilter === 'leads'));
          return <Link key={filter.id} className={active ? 'btn btn-primary' : 'btn'} href={filter.href}>{filter.label}</Link>;
        })}
      </div>

      {canManage ? (
        <details className="card" style={{ marginBottom: 18 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{copy.quickAdd}</summary>
          <div className="form" style={{ marginTop: 14 }}>
            <input className="input" placeholder="Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            <textarea className="input" rows={3} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <label className="auth-field"><span>Logo (optional)</span><input className="input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onLogoSelected(e.target.files?.[0] || null)} /></label>
            {logoPreviewUrl ? <img src={logoPreviewUrl} alt="Logo preview" className="customer-logo-preview" width={72} height={72} /> : null}
            <button className="btn btn-primary" type="button" onClick={() => void addCustomer()} disabled={saving}>{saving ? FEEDBACK.loading : 'Save customer'}</button>
          </div>
        </details>
      ) : null}

      <div className="card">
        {loading && <p className="loading-state" role="status">Loading customers...</p>}
        {!loading && customers.length === 0 && <LocalizedEmptyState emptyKey="customers" />}
        {!loading && visibleCustomers.map((customer) => (
          <div key={customer.id} className="card customer-card-row open-in-new-tab-card" style={{ marginTop: 12 }}>
            <Link href={`/customers/${customer.id}`} target="_blank" rel="noopener noreferrer" className="record-card-overlay-link" aria-label={`Open ${customerDisplayName(customer)} in a new tab`}><span className="record-card-overlay-label">Open {customerDisplayName(customer)} in a new tab</span></Link>
            <CustomerLogo logoPath={customer.logo_path} alt={customerDisplayName(customer)} size={48} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3><Link href={`/customers/${customer.id}`} target="_blank" rel="noopener noreferrer">{customerDisplayName(customer)}</Link></h3>
              <p className="muted">{customerStageLabel(customer.pipeline_stage || customer.record_type || 'active', locale)}{customer.lead_source ? ` · ${customer.lead_source}` : ''}</p>
              <p style={{ fontWeight: 700 }}>{copy.openJobs}: {openJobCounts[customer.id] || 0}</p>
              <p><ContactLink type="phone" value={customer.phone} /></p>
              <p><ContactLink type="email" value={customer.email} /></p>
              <p>{customerDisplayAddress(customer, 'No address')}</p>
              <RecordActions viewHref={`/customers/${customer.id}`} viewLabel="Open" editHref={canManage ? `/customers/${customer.id}` : undefined} editLabel={copy.edit} onRemove={canManage ? async () => {
                if (removingId) return;
                if (!window.confirm(`Remove ${customerDisplayName(customer)}?`)) return;
                setRemovingId(customer.id);
                const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
                const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
                setRemovingId(null);
                if (!res.ok) { appFeedback.error(json.error || 'Unable to remove customer.'); return; }
                appFeedback.label('removed');
                load();
              } : undefined} />
            </div>
          </div>
        ))}
        {!loading && customers.length > 0 ? (
          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            <p className="muted" style={{ margin: 0 }}>{copy.showing} {Math.min(visibleCount, customers.length)} / {customers.length}</p>
            {hasMore ? <button type="button" className="btn" onClick={() => setVisibleCount((count) => count + CUSTOMER_PAGE_SIZE)}>{copy.showMore}</button> : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function CustomersPage() {
  return <Suspense><CustomersPageContent /></Suspense>;
}
