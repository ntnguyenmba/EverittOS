'use client';

import { OsModulePage } from '@/components/os-module-page';
import { OutboundHub } from '@/components/outbound/outbound-hub';
import { canAccessFeature } from '@/lib/plan-access';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export default function EstimatesPage() {
  const [role, setRole] = useState(normalizeRole('employee'));

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setRole(normalizeRole(profile?.role));
    }
    void load();
  }, []);

  return (
    <OsModulePage
      title="Estimates"
      description="Build estimates, send them to customers, and track sent history. Auto-save keeps your work safe."
      requiredPlan="pro"
      requiredFeature="Estimates"
      featureCheck={(plan) => canAccessFeature(plan, 'pdfReports')}
    >
      <OutboundHub docType="estimate" canManage={isManagerRole(role)} showAmount />
    </OsModulePage>
  );
}
