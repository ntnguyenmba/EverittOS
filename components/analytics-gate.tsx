'use client';

import { usePathname } from 'next/navigation';
import { GoogleAnalytics } from '@/components/google-analytics';
import { isPublicAnalyticsPath } from '@/lib/public-analytics-routes';

export function AnalyticsGate() {
  const pathname = usePathname();
  if (!isPublicAnalyticsPath(pathname)) return null;
  return <GoogleAnalytics />;
}
