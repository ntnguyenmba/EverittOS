const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseConfigDiagnostics = {
  configured: boolean;
  urlHost: string | null;
  rawUrlHost: string | null;
  urlCorrected: boolean;
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
  let normalized = value.replace(/\/+$/, '');
  // Common Vercel misconfiguration: *.supabase.com does not resolve; projects use *.supabase.co
  if (/\.supabase\.com$/i.test(normalized)) {
    normalized = normalized.replace(/\.supabase\.com$/i, '.supabase.co');
  }
  return normalized;
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
    return parsed.protocol === 'https:' && /\.supabase\.co$/i.test(parsed.hostname);
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
  const rawUrl = trim(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const { url, anonKey } = getPublicSupabaseConfig();
  let urlHost: string | null = null;
  let rawUrlHost: string | null = null;
  try {
    urlHost = url ? new URL(url).host : null;
    rawUrlHost = rawUrl ? new URL(rawUrl).host : null;
  } catch {
    urlHost = null;
    rawUrlHost = null;
  }

  const urlCorrected = Boolean(rawUrl && url && rawUrl !== url);

  return {
    configured: isSupabaseConfigured(),
    urlHost,
    rawUrlHost,
    urlCorrected,
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
  return 'Authentication is not configured for this deployment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.';
}

/** Values used only so `next build` succeeds without env injection. */
export function buildTimeSupabaseUrl(): string {
  return getSupabaseUrl() || PLACEHOLDER_URL;
}

export function buildTimeSupabaseAnonKey(): string {
  return getSupabaseAnonKey() || PLACEHOLDER_KEY;
}
