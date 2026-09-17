'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ContactLink } from '@/components/contact-link';
import { ExportMenu } from '@/components/export-menu';
import { useTranslation } from '@/components/locale-provider';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { formatSupabaseError } from '@/lib/action-messages';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { filterDemoSeedCustomers } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { CUSTOMER_LIST_SELECT, customerDisplayAddress, customerDisplayName, type CustomerRecord } from '@/lib/customer-record';
import { customerStageLabel, getCustomerLifecycleCopy } from '@/lib/i18n/customer-lifecycle-copy';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { monthStartIso } from '@/lib/date-filters';
import { supabase } from '@/lib/supabase';
import { RecordActions } from '@/components/record-actions';

const CUSTOMER_PAGE_SIZE = 10;

function CustomersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodFilter = searchParams.get('period');
  const stageFilter = searchParams.get('stage') || searchParams.get('status');
  const { t, locale } = useTranslation();
  const copy = {
    en: { edit: 'Edit', open: 'Open', openJobs: 'Open jobs', showMore: 'Show 10 more', showing: 'Showing', importCsv: 'Import CSV', addCustomer: 'Add customer', loading: 'Loading customers…', noAddress: 'No address', removeConfirm: 'Remove {name}?', removeError: 'Unable to remove customer.' },
    es: { edit: 'Editar', open: 'Abrir', openJobs: 'Trabajos abiertos', showMore: 'Mostrar 10 más', showing: 'Mostrando', importCsv: 'Importar CSV', addCustomer: 'Agregar cliente', loading: 'Cargando clientes…', noAddress: 'Sin dirección', removeConfirm: '¿Eliminar {name}?', removeError: 'No se pudo eliminar el cliente.' },
    vi: { edit: 'Sửa', open: 'Mở', openJobs: 'Công việc đang mở', showMore: 'Hiển thị thêm 10', showing: 'Đang hiển thị', importCsv: 'Nhập CSV', addCustomer: 'Thêm khách hàng', loading: 'Đang tải khách hàng…', noAddress: 'Chưa có địa chỉ', removeConfirm: 'Xóa {name}?', removeError: 'Không thể xóa khách hàng.' }
  }[locale];
  const lifecycle = getCustomerLifecycleCopy(locale);
  const exportCopy = getExportCopy(locale);
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [openJobCounts, setOpenJobCounts] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState(CUSTOMER_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [role, setRole] = useState(normalizeRole('owner'));

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const [{ data: profile }, org] = await Promise.all([
      supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
      fetchOrganizationContext(user.id)
    ]);
    const workspaceRole = normalizeRole(org?.role || profile?.role);
    setPlan(normalizePlan(profile?.plan)); setRole(workspaceRole); setCanManage(isManagerRole(workspaceRole));
    let query = supabase.from('customers').select(CUSTOMER_LIST_SELECT).order('created_at', { ascending: false });
    if (org?.organizationId) query = query.eq('organization_id', org.organizationId); else query = query.eq('user_id', user.id);
    if (periodFilter === 'month') query = query.gte('created_at', monthStartIso());
    if (stageFilter === 'lead' || stageFilter === 'leads') query = query.or('record_type.eq.lead,pipeline_stage.in.(lead,qualified,open,contacted,quoted)');
    else if (stageFilter === 'archived') query = query.eq('pipeline_stage', 'archived');
    else if (stageFilter === 'active') query = query.eq('record_type', 'customer').eq('pipeline_stage', 'active');
    else if (stageFilter === 'past' || stageFilter === 'inactive' || stageFilter === 'former') query = query.eq('record_type', 'customer').in('pipeline_stage', ['past', 'inactive', 'former']);
    else query = query.eq('record_type', 'customer').neq('pipeline_stage', 'archived');
    const [{ data, error }, orgIsDemo] = await Promise.all([query, fetchOrganizationIsDemo(supabase, org?.organizationId)]);
    if (error) { setLoading(false); appFeedback.error(formatSupabaseError(error)); return; }
    const visible = filterDemoSeedCustomers(data || [], orgIsDemo) as CustomerRecord[];
    setCustomers(visible); setVisibleCount(CUSTOMER_PAGE_SIZE);
    const ids = visible.map((customer) => customer.id).filter(Boolean);
    if (ids.length) {
      let jobsQuery = supabase.from('jobs').select('customer_id, status').in('customer_id', ids);
      if (org?.organizationId) jobsQuery = jobsQuery.eq('organization_id', org.organizationId); else jobsQuery = jobsQuery.eq('user_id', user.id);
      const { data: jobRows } = await jobsQuery;
      const counts: Record<string, number> = {};
      for (const row of jobRows || []) { const status = String(row.status || '').toLowerCase(); if (['completed','finished','cancelled','canceled'].includes(status)) continue; const customerId = String(row.customer_id || ''); if (customerId) counts[customerId] = (counts[customerId] || 0) + 1; }
      setOpenJobCounts(counts);
    } else setOpenJobCounts({});
    setLoading(false);
  }

  useEffect(() => { void load(); }, [periodFilter, stageFilter]);
  const visibleCustomers = customers.slice(0, visibleCount);
  const hasMore = visibleCount < customers.length;

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader title={t('nav.crm')} subtitle={t('ux.pageTitles.customers')} action={
        <div className="customers-header-actions" style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {isManagerRole(role) ? <Link className="btn" href="/customers/import">{copy.importCsv}</Link> : null}
          {isManagerRole(role) ? <ExportMenu endpoint="/api/exports/customers" query={{ period:periodFilter, stage:stageFilter }} locale={locale} disabled={loading} onError={(message)=>appFeedback.error(message||exportCopy.exportFailed)} onSuccess={(format)=>{if(format==='share')appFeedback.success(exportCopy.shareSent);}} /> : null}
          {canManage ? <button type="button" className="btn btn-primary" onClick={()=>window.location.assign('/customers/new')}>{copy.addCustomer}</button> : null}
        </div>
      } />
      <div className="job-detail-actions" style={{ marginBottom:16, flexWrap:'wrap', gap:8 }}>
        {([{id:'customers',label:lifecycle.filters.customers,href:'/customers'},{id:'leads',label:lifecycle.filters.leads,href:'/customers?stage=leads'},{id:'archived',label:lifecycle.filters.archived,href:'/customers?stage=archived'}] as const).map((filter)=>{const active=filter.id==='customers'?!stageFilter||stageFilter==='customers':stageFilter===filter.id||(filter.id==='leads'&&(stageFilter==='lead'||stageFilter==='leads'));return <Link key={filter.id} className={active?'btn btn-primary':'btn'} href={filter.href}>{filter.label}</Link>;})}
      </div>
      <div className="customers-list">
        {loading && <p className="loading-state" role="status">{copy.loading}</p>}
        {!loading && customers.length===0 && <LocalizedEmptyState emptyKey="customers" icon="none" showAction={false} />}
        {!loading && visibleCustomers.map((customer)=>(
          <div key={customer.id} className="list-row customer-card-row">
            <div style={{minWidth:0,width:'100%'}}>
              <h3><Link href={`/customers/${customer.id}`} target="_blank" rel="noopener noreferrer">{customerDisplayName(customer)}</Link></h3>
              <p className="muted">{customerStageLabel(customer.pipeline_stage||customer.record_type||'active',locale)}{customer.lead_source?` · ${customer.lead_source}`:''}</p>
              <p style={{fontWeight:700}}>{copy.openJobs}: {openJobCounts[customer.id]||0}</p>
              <p><ContactLink type="phone" value={customer.phone}/></p>
              <p><ContactLink type="email" value={customer.email}/></p>
              <p>{customerDisplayAddress(customer,copy.noAddress)}</p>
              <RecordActions viewHref={`/customers/${customer.id}`} viewLabel={copy.open} editHref={canManage?`/customers/${customer.id}`:undefined} editLabel={copy.edit} onRemove={canManage?async()=>{if(removingId)return;if(!window.confirm(copy.removeConfirm.replace('{name}',customerDisplayName(customer))))return;setRemovingId(customer.id);const res=await fetch(`/api/customers/${customer.id}`,{method:'DELETE'});const json=(await res.json().catch(()=>({}))) as {error?:string};setRemovingId(null);if(!res.ok){appFeedback.error(json.error||copy.removeError);return;}appFeedback.label('removed');void load();}:undefined}/>
            </div>
          </div>
        ))}
        {!loading&&customers.length>0?<div className="record-count" style={{display:'grid',gap:8,marginTop:16}}><p className="muted" style={{margin:0}}>{copy.showing} {Math.min(visibleCount,customers.length)} / {customers.length}</p>{hasMore?<button type="button" className="btn" onClick={()=>setVisibleCount((count)=>count+CUSTOMER_PAGE_SIZE)}>{copy.showMore}</button>:null}</div>:null}
      </div>
    </AppShell>
  );
}

export default function CustomersPage(){return <Suspense><CustomersPageContent/></Suspense>;}
