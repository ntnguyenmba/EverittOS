'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ExportMenu } from '@/components/export-menu';
import { OutboundHub } from '@/components/outbound/outbound-hub';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canAccessFinancials } from '@/lib/finance-access';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

function ReceiptsPageContent() {
  const searchParams = useSearchParams();
  const { locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale);
  const exportCopy = getExportCopy(locale);
  const appFeedback = useAppFeedback();
  const invoiceId = searchParams.get('invoiceId') || '';
  const paymentId = searchParams.get('paymentId') || '';
  const jobId = searchParams.get('jobId') || '';
  const customerId = searchParams.get('customerId') || '';
  const returnTo = searchParams.get('returnTo') || (jobId ? `/jobs/${jobId}` : '');
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
      const userPlan = normalizePlan(profile?.plan);
      setPlan(userPlan);
      setRole(workspaceRole);
      setCanManage(isManagerRole(workspaceRole) && canAccessFinancials(workspaceRole, userPlan));
    }
    void load();
  }, []);

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <div>
          <h1>{billingCopy.paymentReceipt}</h1>
          <p className="page-subtitle">{billingCopy.receiptsSubtitle}</p>
        </div>
        {canManage ? (
          <ExportMenu
            endpoint="/api/exports/payments"
            query={{ jobId, customerId, invoiceId }}
            locale={locale}
            onError={(message) => appFeedback.error(message || exportCopy.exportFailed)}
            onSuccess={(format) => {
              if (format === 'share') appFeedback.success(exportCopy.shareSent);
            }}
          />
        ) : null}
      </header>

      {jobId ? (
        <div className="button-row" style={{ marginBottom: 14 }}>
          <Link className="btn" href={`/jobs/${jobId}`}>Back to job</Link>
        </div>
      ) : null}

      <OutboundHub
        docType="receipt"
        canManage={canManage}
        showAmount
        initialJobId={jobId}
        initialCustomerId={customerId}
        initialInvoiceId={invoiceId}
        initialPaymentId={paymentId}
        returnTo={returnTo}
      />
    </AppShell>
  );
}

export default function ReceiptsPage() {
  const { locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale);
  return (
    <Suspense fallback={<p className="muted">{billingCopy.loading}</p>}>
      <ReceiptsPageContent />
    </Suspense>
  );
}
