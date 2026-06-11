const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  );
}

/** True when real Supabase credentials are present (not CI placeholders). */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(url && key && url !== PLACEHOLDER_URL && key !== PLACEHOLDER_KEY);
}

/** Browser build may embed placeholders when env is missing at build time. */
export function isBrowserSupabaseMisconfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    PLACEHOLDER_KEY;
  return url === PLACEHOLDER_URL || key === PLACEHOLDER_KEY;
}

export function supabaseConfigError(): string {
  if (typeof window === 'undefined') {
    return 'Authentication service is not configured on the server.';
  }
  return 'Authentication is not configured for this deployment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.';
}

/** Values used only so `next build` succeeds without env injection. */
export function buildTimeSupabaseUrl(): string {
  return getSupabaseUrl() || PLACEHOLDER_URL;
}

export function buildTimeSupabaseAnonKey(): string {
  return getSupabaseAnonKey() || PLACEHOLDER_KEY;
}
