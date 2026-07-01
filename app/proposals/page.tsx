'use client';

import { OsModulePage } from '@/components/os-module-page';
import { OutboundHub } from '@/components/outbound/outbound-hub';
import { canAccessFeature } from '@/lib/plan-access';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export default function ProposalsPage() {
  const [role, setRole] = useState(normalizeRole('employee'));

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const org = await fetchOrganizationContext(user.id);
      setRole(normalizeRole(org?.role || profile?.role));
    }
    void load();
  }, []);

  return (
    <OsModulePage
      title="Proposal Center"
      description="Create, review, and send proposals. Work saves automatically — send when you are ready."
      requiredPlan="pro"
      requiredFeature="Proposals"
      featureCheck={(plan) => canAccessFeature(plan, 'pdfReports')}
    >
      <OutboundHub docType="proposal" canManage={isManagerRole(role)} showAmount />
    </OsModulePage>
  );
}
