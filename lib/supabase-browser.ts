import { createBrowserClient } from '@supabase/ssr';
import {
  buildTimeSupabaseAnonKey,
  buildTimeSupabaseUrl,
  readRuntimeConfigFromDom
} from '@/lib/supabase-config';
import { retryUpload } from '@/lib/upload-retry';

type BrowserClient = any;

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

function installPhotoUploadRetry(client: BrowserClient) {
  const storage = client?.storage;
  if (!storage || storage.__everittPhotoRetryInstalled) return;

  const originalFrom = storage.from.bind(storage);
  storage.from = (bucket: string) => {
    const bucketApi = originalFrom(bucket);
    if (bucket !== 'job-photos' || !bucketApi?.upload) return bucketApi;

    const originalUpload = bucketApi.upload.bind(bucketApi);
    bucketApi.upload = (...args: unknown[]) =>
      retryUpload(
        () => originalUpload(...args),
        (result: { error?: unknown } | null | undefined) => result?.error,
        { attempts: 3, baseDelayMs: 700 }
      );
    return bucketApi;
  };

  storage.__everittPhotoRetryInstalled = true;
}

let browserClient: BrowserClient | undefined;

export function getBrowserSupabase(): BrowserClient {
  if (!browserClient) {
    const { url, anonKey } = resolveBrowserConfig();
    browserClient = createBrowserClient<any>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        experimental: { passkey: true }
      }
    });
    installPhotoUploadRetry(browserClient);
  }
  return browserClient;
}

export function resetBrowserSupabase(): void {
  browserClient = undefined;
}

/** Lazy browser client. Reads runtime config injected in root layout when available. */
export const supabase: BrowserClient = new Proxy({} as BrowserClient, {
  get(_target, prop) {
    const client = getBrowserSupabase();
    const value = Reflect.get(client, prop, client);
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  }
});