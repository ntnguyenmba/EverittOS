'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ExportMenu } from '@/components/export-menu';
import { OutboundHub } from '@/components/outbound/outbound-hub';
import { QuickBooksIntegrationPanel } from '@/components/quickbooks-integration-panel';
import { RecurringInvoicesPanel } from '@/components/recurring-invoices-panel';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

function InvoicesPageContent() {
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale); const exportCopy = getExportCopy(locale); const appFeedback = useAppFeedback();
  const jobId = searchParams.get('jobId') || ''; const customerId = searchParams.get('customerId') || ''; const invoiceId = searchParams.get('invoiceId') || '';
  const forceNew = searchParams.get('action') === 'new' || searchParams.get('forceNew') === '1'; const returnTo = searchParams.get('returnTo') || (jobId ? `/jobs/${jobId}` : '');
  const paymentParam = (searchParams.get('payment') || 'all').toLowerCase(); const focusOutstanding = searchParams.get('focus') === 'outstanding';
  const paymentFilter = paymentParam === 'unpaid' || paymentParam === 'overdue' || paymentParam === 'paid' || paymentParam === 'history' ? paymentParam : 'all';
  const [plan, setPlan] = useState<EverittosPlan>('free'); const [role, setRole] = useState<UserRole>('owner'); const [canManage, setCanManage] = useState(false);

  useEffect(() => { async function load() { const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(); const org = await fetchOrganizationContext(user.id); const workspaceRole = normalizeRole(org?.role || profile?.role); setPlan(normalizePlan(profile?.plan)); setRole(workspaceRole); setCanManage(isManagerRole(workspaceRole)); } void load(); }, []);

  return <AppShell plan={plan} role={role}>
    <header className="page-header"><div><h1>{focusOutstanding ? billingCopy.outstandingBalances : t('pages.invoices.title')}</h1><p className="page-subtitle">{focusOutstanding ? billingCopy.outstandingSubtitle : t('pages.invoices.subtitle')}</p></div>{canManage ? <ExportMenu endpoint="/api/exports/invoices" query={{ jobId, customerId, payment: paymentFilter === 'all' ? '' : paymentFilter }} locale={locale} onError={(message) => appFeedback.error(message || exportCopy.exportFailed)} onSuccess={(format) => { if (format === 'share') appFeedback.success(exportCopy.shareSent); }} /> : null}</header>
    {jobId ? <div className="button-row" style={{ marginBottom: 14 }}><Link className="btn" href={`/jobs/${jobId}`}>Back to job</Link></div> : null}
    {canManage && !focusOutstanding ? <div className="button-row" style={{ marginBottom: 18 }}><Link className="btn" href="/settings/payments">Invoice payment settings</Link></div> : null}
    <OutboundHub docType="invoice" canManage={canManage} showAmount initialJobId={jobId} initialCustomerId={customerId} initialInvoiceId={invoiceId} forceNew={forceNew} paymentFilter={paymentFilter} focusOutstanding={focusOutstanding} returnTo={returnTo} />
    {!focusOutstanding ? <RecurringInvoicesPanel canManage={canManage} /> : null}
    {canManage ? <details style={{ marginTop: 24 }}><summary><strong>{billingCopy.paymentConnections}</strong></summary><div style={{ marginTop: 12, display: 'grid', gap: 12 }}><div className="card"><Link className="btn" href="/settings/billing">{billingCopy.subscription}</Link></div><QuickBooksIntegrationPanel canManage={canManage} /></div></details> : null}
  </AppShell>;
}

export default function InvoicesPage() { const { t } = useTranslation(); return <Suspense fallback={<p className="muted">{t('pages.invoices.loading')}</p>}><InvoicesPageContent /></Suspense>; }
