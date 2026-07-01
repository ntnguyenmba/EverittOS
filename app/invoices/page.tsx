'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { OutboundHub } from '@/components/outbound/outbound-hub';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

function InvoicesPageContent() {
  const searchParams = useSearchParams();
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
      setPlan(normalizePlan(profile?.plan));
      setRole(workspaceRole);
      setCanManage(isManagerRole(workspaceRole));
    }
    void load();
  }, []);

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>Invoices</h1>
        <p className="page-subtitle">
          Send invoices to customers in one step. Amount and message auto-save while you compose.
        </p>
      </header>

      <OutboundHub
        docType="invoice"
        canManage={canManage}
        showAmount
        initialJobId={jobId}
        initialCustomerId={customerId}
      />
    </AppShell>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<p className="muted">Loading invoices…</p>}>
      <InvoicesPageContent />
    </Suspense>
  );
}
