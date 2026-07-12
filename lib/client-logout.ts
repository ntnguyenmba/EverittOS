import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { performPlatformLogoutCleanup } from '@/lib/platform/session-cleanup';
import { supabase } from '@/lib/supabase';

/** Signs out via API (clears session markers) with client fallback. */
export async function performClientLogout(router?: AppRouterInstance) {
  try {
    await fetch('/api/auth/sign-out', { method: 'POST' });
  } catch {
    await supabase.auth.signOut();
  }

  await performPlatformLogoutCleanup();

  if (router) {
    router.push('/login');
    router.refresh();
    return;
  }

  window.location.href = '/login';
}
