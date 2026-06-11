const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseConfigDiagnostics = {
  configured: boolean;
  urlHost: string | null;
  anonKeyPresent: boolean;
  serviceRolePresent: boolean;
  usingPlaceholder: boolean;
  appUrl: string | null;
};

function trim(value: string | undefined | null): string {
  return (value || '').trim();
}

export function normalizeSupabaseUrl(raw: string | undefined | null): string {
  const value = trim(raw);
  if (!value) return '';
  return value.replace(/\/+$/, '');
}

export function getSupabaseUrl(): string {
  return normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabaseAnonKey(): string {
  return trim(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function getServiceRoleKey(): string {
  return trim(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getPublicSupabaseConfig(): SupabasePublicConfig {
  return {
    url: getSupabaseUrl(),
    anonKey: getSupabaseAnonKey()
  };
}

export function isPlaceholderConfig(url: string, anonKey: string): boolean {
  return !url || !anonKey || url === PLACEHOLDER_URL || anonKey === PLACEHOLDER_KEY;
}

/** True when real Supabase credentials are present (not CI placeholders). */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getPublicSupabaseConfig();
  if (isPlaceholderConfig(url, anonKey)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.includes('supabase');
  } catch {
    return false;
  }
}

/** Browser build may embed placeholders when env is missing at build time. */
export function isBrowserSupabaseMisconfigured(): boolean {
  if (typeof document !== 'undefined') {
    const runtime = readRuntimeConfigFromDom();
    if (runtime?.configured) return false;
  }

  const url = trim(process.env.NEXT_PUBLIC_SUPABASE_URL) || PLACEHOLDER_URL;
  const key = trim(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) || PLACEHOLDER_KEY;
  return isPlaceholderConfig(url, key);
}

export function readRuntimeConfigFromDom(): { url: string; anonKey: string; configured: boolean } | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('everittos-supabase-config');
  if (!el?.textContent) return null;
  try {
    const parsed = JSON.parse(el.textContent) as { url?: string; anonKey?: string; configured?: boolean };
    const url = normalizeSupabaseUrl(parsed.url);
    const anonKey = trim(parsed.anonKey);
    return {
      url,
      anonKey,
      configured: Boolean(parsed.configured && url && anonKey && !isPlaceholderConfig(url, anonKey))
    };
  } catch {
    return null;
  }
}

export function supabaseConfigDiagnostics(): SupabaseConfigDiagnostics {
  const { url, anonKey } = getPublicSupabaseConfig();
  let urlHost: string | null = null;
  try {
    urlHost = url ? new URL(url).host : null;
  } catch {
    urlHost = null;
  }

  return {
    configured: isSupabaseConfigured(),
    urlHost,
    anonKeyPresent: Boolean(anonKey),
    serviceRolePresent: Boolean(getServiceRoleKey()),
    usingPlaceholder: isPlaceholderConfig(url, anonKey),
    appUrl: trim(process.env.NEXT_PUBLIC_APP_URL) || null
  };
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
