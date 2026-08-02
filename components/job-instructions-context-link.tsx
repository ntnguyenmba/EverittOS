'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

const COPY = {
  en: {
    title: 'Job instructions',
    customer: 'Add instructions for this customer or property.',
    job: 'View or manage instructions for this job.',
    action: 'Open instructions'
  },
  es: {
    title: 'Instrucciones de trabajo',
    customer: 'Agregue instrucciones para este cliente o propiedad.',
    job: 'Vea o administre las instrucciones de este trabajo.',
    action: 'Abrir instrucciones'
  },
  vi: {
    title: 'Hướng dẫn công việc',
    customer: 'Thêm hướng dẫn cho khách hàng hoặc bất động sản này.',
    job: 'Xem hoặc quản lý hướng dẫn cho công việc này.',
    action: 'Mở hướng dẫn'
  }
} as const;

export function JobInstructionsContextLink() {
  const pathname = usePathname();
  const { locale } = useTranslation();
  const copy = COPY[locale];
  const [canManage, setCanManage] = useState(false);

  const context = useMemo(() => {
    const customerMatch = pathname.match(/^\/customers\/([^/]+)$/);
    if (customerMatch) return { type: 'customer', id: customerMatch[1] } as const;

    const jobMatch = pathname.match(/^\/jobs\/([^/]+)$/);
    if (jobMatch && jobMatch[1] !== 'new') return { type: 'job', id: jobMatch[1] } as const;

    return null;
  }, [pathname]);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      if (!context) {
        if (active) setCanManage(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) setCanManage(false);
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const role = normalizeRole(profile?.role);
      if (active) setCanManage(!isClientRole(role) && !isContractorRole(role));
    }

    void loadRole();
    return () => { active = false; };
  }, [context]);

  if (!context || !canManage) return null;

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
