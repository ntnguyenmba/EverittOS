'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { OutboundHub } from '@/components/outbound/outbound-hub';
import { QuickBooksIntegrationPanel } from '@/components/quickbooks-integration-panel';
import { RecurringInvoicesPanel } from '@/components/recurring-invoices-panel';
import { useTranslation } from '@/components/locale-provider';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

function InvoicesPageContent() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const jobId = searchParams.get('jobId') || '';
  const customerId = searchParams.get('customerId') || '';
  const paymentParam = (searchParams.get('payment') || 'all').toLowerCase();
  const focusOutstanding = searchParams.get('focus') === 'outstanding';
  const paymentFilter =
    paymentParam === 'unpaid' ||
    paymentParam === 'overdue' ||
    paymentParam === 'paid' ||
    paymentParam === 'history'
      ? paymentParam
      : 'all';
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const org = await fetchOrganizationContext(user.id);
      const workspaceRole = normalizeRole(org?.role || profile?.role);
      setPlan(normalizePlan(profile?.plan));
      setRole(workspaceRole);
      setCanManage(isManagerRole(workspaceRole));
    }
    void load();
  }, []);

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>{focusOutstanding ? 'Outstanding balances' : t('pages.invoices.title')}</h1>
        <p className="page-subtitle">
          {focusOutstanding
            ? 'See exactly which invoices are unpaid or overdue. Uninvoiced job balances are reviewed from Jobs.'
            : t('pages.invoices.subtitle')}
        </p>
      </header>

      <OutboundHub
        docType="invoice"
        canManage={canManage}
        showAmount
        initialJobId={jobId}
        initialCustomerId={customerId}
        paymentFilter={paymentFilter}
        focusOutstanding={focusOutstanding}
      />

      {!focusOutstanding ? <RecurringInvoicesPanel canManage={canManage} /> : null}

      {canManage ? (
        <details style={{ marginTop: 24 }}>
          <summary>
            <strong>Payment connections</strong>
          </summary>
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            <div className="card">
              <Link className="btn" href="/settings/billing">
                Subscription
              </Link>
            </div>
            <QuickBooksIntegrationPanel canManage={canManage} />
          </div>
        </details>
      ) : null}
    </AppShell>
  );
}

export default function InvoicesPage() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<p className="muted">{t('pages.invoices.loading')}</p>}>
      <InvoicesPageContent />
    </Suspense>
  );
}
