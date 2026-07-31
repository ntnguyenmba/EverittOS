'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { OutboundHub } from '@/components/outbound/outbound-hub';
import { useTranslation } from '@/components/locale-provider';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canAccessFinancials } from '@/lib/finance-access';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

function ReceiptsPageContent() {
  const searchParams = useSearchParams();
  const { locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale);
  const invoiceId = searchParams.get('invoiceId') || '';
  const paymentId = searchParams.get('paymentId') || '';
  const jobId = searchParams.get('jobId') || '';
  const customerId = searchParams.get('customerId') || '';
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
        <h1>{billingCopy.paymentReceipt}</h1>
        <p className="page-subtitle">
          {locale === 'es'
            ? 'Envía recibos de pago a tus clientes. Los detalles se completan desde la factura pagada.'
            : locale === 'vi'
              ? 'Gửi biên nhận thanh toán cho khách hàng. Chi tiết được điền từ hóa đơn đã thanh toán.'
              : 'Send payment receipts to customers. Details are filled from the paid invoice.'}
        </p>
      </header>

      <OutboundHub
        docType="receipt"
        canManage={canManage}
        showAmount
        initialJobId={jobId}
        initialCustomerId={customerId}
        initialInvoiceId={invoiceId}
        initialPaymentId={paymentId}
      />
    </AppShell>
  );
}

export default function ReceiptsPage() {
  const { locale } = useTranslation();
  const billingCopy = getBillingOpsCopy(locale);
  return (
    <Suspense fallback={<p className="muted">{billingCopy.paymentReceipt}…</p>}>
      <ReceiptsPageContent />
    </Suspense>
  );
}
