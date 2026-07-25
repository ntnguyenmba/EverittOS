import { createBrowserClient } from '@supabase/ssr';
import {
  buildTimeSupabaseAnonKey,
  buildTimeSupabaseUrl,
  readRuntimeConfigFromDom
} from '@/lib/supabase-config';

type BrowserClient = ReturnType<typeof createBrowserClient<any>>;

function resolveBrowserConfig(): { url: string; anonKey: string } {
  const runtime = readRuntimeConfigFromDom();
  if (runtime?.configured) {
    return { url: runtime.url, anonKey: runtime.anonKey };
  }

  return {
    url: buildTimeSupabaseUrl(),
    anonKey: buildTimeSupabaseAnonKey()
  };
}

let browserClient: BrowserClient | undefined;

export function getBrowserSupabase(): BrowserClient {
  if (!browserClient) {
    const { url, anonKey } = resolveBrowserConfig();
    browserClient = createBrowserClient<any>(url, anonKey, {
      auth: {
        experimental: { passkey: true }
      }
    });
  }
  return browserClient;
}

export function resetBrowserSupabase(): void {
  browserClient = undefined;
}

/** Lazy browser client. Reads runtime config injected in root layout when available. */
export const supabase: BrowserClient = new Proxy({} as BrowserClient, {
  get(_target, prop, receiver) {
    const client = getBrowserSupabase();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  }
});
