'use client';

import { usePathname } from 'next/navigation';
import { PersonalWorkMetrics } from '@/components/dashboard/personal-work-metrics';

export function PersonalMetricsMount({ role }: { role: string | null | undefined }) {
  const pathname = usePathname();
  if (pathname !== '/dashboard') return null;
  return <PersonalWorkMetrics role={role || ''} />;
}
