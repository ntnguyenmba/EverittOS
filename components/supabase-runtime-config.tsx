import { getPublicSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase-config';

/** Injects runtime Supabase public config so the browser client does not rely on build-time placeholders. */
export function SupabaseRuntimeConfig() {
  const { url, anonKey } = getPublicSupabaseConfig();
  const payload = JSON.stringify({
    url,
    anonKey,
    configured: isSupabaseConfigured()
  });

  return (
    <script
      id="everittos-supabase-config"
      type="application/json"
      dangerouslySetInnerHTML={{ __html: payload }}
    />
  );
}
