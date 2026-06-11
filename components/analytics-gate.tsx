'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { GoogleAnalytics } from '@/components/google-analytics';
import { analyticsAllowed, hasCookieConsentChoice } from '@/lib/cookie-consent';
import { isPublicAnalyticsPath } from '@/lib/public-analytics-routes';

export function AnalyticsGate() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    function refresh() {
      setAllowed(hasCookieConsentChoice() && analyticsAllowed());
    }
    refresh();
    window.addEventListener('everittos:cookie-consent', refresh);
    return () => window.removeEventListener('everittos:cookie-consent', refresh);
  }, [pathname]);

  if (!isPublicAnalyticsPath(pathname) || !allowed) return null;
  return <GoogleAnalytics />;
}
