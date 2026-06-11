import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig, getServiceRoleKey } from '@/lib/supabase-config';
import { logAuthEvent } from '@/lib/auth-logger';

export function createAdminSupabase(): SupabaseClient | null {
  const { url } = getPublicSupabaseConfig();
  const key = getServiceRoleKey();

  if (!url || !key) {
    logAuthEvent('supabase_admin_unconfigured', {
      urlPresent: url ? 1 : 0,
      serviceRolePresent: key ? 1 : 0
    });
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
