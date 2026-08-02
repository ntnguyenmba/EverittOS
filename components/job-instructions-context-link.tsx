'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

const COPY = {
  en: {
    title: 'Job instructions',
    customer: 'Add instructions for this customer or property.',
    job: 'View or manage instructions for this job.',
    dashboardTitle: 'Create your first job instructions',
    dashboardText: 'Set the steps your team should follow for every job.',
    dashboardAction: 'Create instructions',
    action: 'Open instructions'
  },
  es: {
    title: 'Instrucciones de trabajo',
    customer: 'Agregue instrucciones para este cliente o propiedad.',
    job: 'Vea o administre las instrucciones de este trabajo.',
    dashboardTitle: 'Cree sus primeras instrucciones de trabajo',
    dashboardText: 'Defina los pasos que su equipo debe seguir en cada trabajo.',
    dashboardAction: 'Crear instrucciones',
    action: 'Abrir instrucciones'
  },
  vi: {
    title: 'Hướng dẫn công việc',
    customer: 'Thêm hướng dẫn cho khách hàng hoặc bất động sản này.',
    job: 'Xem hoặc quản lý hướng dẫn cho công việc này.',
    dashboardTitle: 'Tạo hướng dẫn công việc đầu tiên',
    dashboardText: 'Đặt các bước nhóm của bạn cần làm cho mỗi công việc.',
    dashboardAction: 'Tạo hướng dẫn',
    action: 'Mở hướng dẫn'
  }
} as const;

export function JobInstructionsContextLink() {
  const pathname = usePathname();
  const { locale } = useTranslation();
  const copy = COPY[locale];
  const [canManage, setCanManage] = useState(false);
  const [showDashboardPrompt, setShowDashboardPrompt] = useState(false);

  const context = useMemo(() => {
    if (pathname === '/dashboard') return { type: 'dashboard', id: '' } as const;

    const customerMatch = pathname.match(/^\/customers\/([^/]+)$/);
    if (customerMatch) return { type: 'customer', id: customerMatch[1] } as const;

    const jobMatch = pathname.match(/^\/jobs\/([^/]+)$/);
    if (jobMatch && jobMatch[1] !== 'new') return { type: 'job', id: jobMatch[1] } as const;

    return null;
  }, [pathname]);

  useEffect(() => {
    let active = true;

    async function loadAccess() {
      if (!context) {
        if (active) {
          setCanManage(false);
          setShowDashboardPrompt(false);
        }
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) {
          setCanManage(false);
          setShowDashboardPrompt(false);
        }
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const role = normalizeRole(profile?.role);
      const allowed = !isClientRole(role) && !isContractorRole(role);
      if (!active) return;
      setCanManage(allowed);

      if (!allowed || context.type !== 'dashboard') {
        setShowDashboardPrompt(false);
        return;
      }

      const workspace = await ensureOrganizationForUser(user.id);
      if (!workspace || !active) {
        setShowDashboardPrompt(false);
        return;
      }

      const { count, error } = await supabase
        .from('job_instruction_templates')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', workspace.organizationId)
        .eq('active', true);

      if (!active) return;
      setShowDashboardPrompt(!error && (count || 0) === 0);
    }

    void loadAccess();
    return () => { active = false; };
  }, [context]);

  if (!context || !canManage) return null;
  if (context.type === 'dashboard' && !showDashboardPrompt) return null;

  if (context.type === 'dashboard') {
    return (
      <aside className="job-instructions-context-link job-instructions-dashboard-prompt" aria-label={copy.dashboardTitle}>
        <div>
          <strong>{copy.dashboardTitle}</strong>
          <span>{copy.dashboardText}</span>
        </div>
        <Link className="btn btn-sm btn-primary" href="/settings/account/job-instructions">{copy.dashboardAction}</Link>
      </aside>
    );
  }

  const params = new URLSearchParams();
  params.set(context.type, context.id);
  const href = `/settings/account/job-instructions?${params.toString()}`;

  return (
    <aside className="job-instructions-context-link" aria-label={copy.title}>
      <div>
        <strong>{copy.title}</strong>
        <span>{context.type === 'customer' ? copy.customer : copy.job}</span>
      </div>
      <Link className="btn btn-sm" href={href}>{copy.action}</Link>
    </aside>
  );
}
