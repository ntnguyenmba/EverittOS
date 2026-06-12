'use client';

import { useEffect, useState } from 'react';
import { isBrowserSupabaseMisconfigured } from '@/lib/supabase-config';

/** Warns when the browser client cannot reach Supabase (misconfigured build env). */
export function AppConnectivityBanner() {
  const [misconfigured, setMisconfigured] = useState(false);

  useEffect(() => {
    setMisconfigured(isBrowserSupabaseMisconfigured());
  }, []);

  if (!misconfigured) return null;

  return (
    <div className="app-connectivity-banner" role="alert">
      Authentication is not configured for this deployment. Buttons that save data will not work until{' '}
      <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are set and the app is
      redeployed.
    </div>
  );
}
