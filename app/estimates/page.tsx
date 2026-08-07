'use client';

import { OsModulePage } from '@/components/os-module-page';
import { OutboundHub } from '@/components/outbound/outbound-hub';
import { useTranslation } from '@/components/locale-provider';
import { canAccessFeature } from '@/lib/plan-access';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

const copy = {
  en: {
    title: 'Estimates',
    description: 'Build estimates, send them to customers, and track sent history. Auto-save keeps your work safe.',
    feature: 'Estimates'
  },
  es: {
    title: 'Estimaciones',
    description: 'Cree estimaciones, envíelas a los clientes y supervise el historial de envíos. El autoguardado protege su trabajo.',
    feature: 'Estimaciones'
  },
  vi: {
    title: 'Ước tính',
    description: 'Tạo ước tính, gửi cho khách hàng và theo dõi lịch sử đã gửi. Tự động lưu giúp bảo vệ công việc của bạn.',
    feature: 'Ước tính'
  }
} as const;

export default function EstimatesPage() {
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;
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
      title={c.title}
      description={c.description}
      requiredPlan="pro"
      requiredFeature={c.feature}
      featureCheck={(plan) => canAccessFeature(plan, 'pdfReports')}
    >
      <OutboundHub docType="estimate" canManage={isManagerRole(role)} showAmount />
    </OsModulePage>
  );
}
