import { logAuthEvent } from '@/lib/auth-logger';
import { resolveClientApiUrl } from '@/lib/client-api-url';

export const LOGIN_API_PATH = '/api/auth/login';
export const SETUP_API_PATH = '/api/auth/setup';

export type AuthFetchResult = {
  response: Response;
  url: string;
  method: string;
};

/** Logged fetch for auth API routes — always uses an absolute same-origin URL. */
export async function authApiFetch(path: string, init: RequestInit = {}): Promise<AuthFetchResult> {
  const url = resolveClientApiUrl(path);
  const method = (init.method || 'GET').toUpperCase();

  console.info('[everittos-auth] fetch start', { method, url });
  logAuthEvent('auth_fetch_start', { method, endpoint: url });

  const response = await fetch(url, {
    ...init,
    credentials: init.credentials ?? 'include',
    cache: init.cache ?? 'no-store'
  });

  console.info('[everittos-auth] fetch response', {
    method,
    url,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });
  logAuthEvent('auth_fetch_response', {
    method,
    endpoint: url,
    status: response.status,
    ok: response.ok ? 1 : 0
  });

  return { response, url, method };
}
