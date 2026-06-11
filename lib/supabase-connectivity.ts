import { getPublicSupabaseConfig, supabaseConfigDiagnostics } from '@/lib/supabase-config';
import { logAuthEvent } from '@/lib/auth-logger';

export type SupabaseConnectivityResult = {
  ok: boolean;
  status?: number;
  latencyMs?: number;
  error?: string;
  urlHost?: string | null;
};

/** Probe Supabase Auth health from the server before sign-in. */
export async function checkSupabaseConnectivity(): Promise<SupabaseConnectivityResult> {
  const { url, anonKey } = getPublicSupabaseConfig();
  const diagnostics = supabaseConfigDiagnostics();

  if (!diagnostics.configured) {
    return {
      ok: false,
      error: 'Supabase is not configured (missing or placeholder URL/key).',
      urlHost: diagnostics.urlHost
    };
  }

  const started = Date.now();
  const healthUrl = `${url}/auth/v1/health`;

  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      },
      cache: 'no-store'
    });

    const latencyMs = Date.now() - started;
    const ok = response.ok;

    logAuthEvent('supabase_connectivity', {
      ok: ok ? 1 : 0,
      status: response.status,
      latencyMs,
      host: diagnostics.urlHost || 'unknown'
    });

    if (!ok) {
      const body = await response.text().catch(() => '');
      return {
        ok: false,
        status: response.status,
        latencyMs,
        error: `Supabase health check returned HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
        urlHost: diagnostics.urlHost
      };
    }

    return { ok: true, status: response.status, latencyMs, urlHost: diagnostics.urlHost };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    logAuthEvent('supabase_connectivity_failed', {
      latencyMs,
      host: diagnostics.urlHost || 'unknown',
      reason: message
    });
    return {
      ok: false,
      latencyMs,
      error: message,
      urlHost: diagnostics.urlHost
    };
  }
}
