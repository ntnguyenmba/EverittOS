import { logAuthDebug } from '@/lib/auth-debug';
import { resolveClientApiUrl } from '@/lib/client-api-url';

export const LOGIN_API_PATH = '/api/auth/login';
export const SETUP_API_PATH = '/api/auth/setup';

export type AuthFetchResult = {
  response: Response;
  url: string;
  method: string;
};

/** Fetch for auth API routes. Uses absolute same-origin URLs from NEXT_PUBLIC_APP_URL. */
export async function authApiFetch(path: string, init: RequestInit = {}): Promise<AuthFetchResult> {
  const url = resolveClientApiUrl(path);
  const method = (init.method || 'GET').toUpperCase();

  logAuthDebug('auth_fetch_start', { method, endpoint: path, requestedUrl: url });

  const response = await fetch(url, {
    ...init,
    credentials: init.credentials ?? 'include',
    cache: init.cache ?? 'no-store'
  });

  logAuthDebug('auth_fetch_response', {
    method,
    endpoint: path,
    requestedUrl: url,
    status: response.status,
    ok: response.ok ? 1 : 0
  });

  return { response, url, method };
}
