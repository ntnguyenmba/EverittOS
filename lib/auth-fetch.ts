import { logAuthDebug } from '@/lib/auth-debug';
import { resolveClientApiUrl } from '@/lib/client-api-url';

export const LOGIN_API_PATH = '/api/auth/login';
export const SETUP_API_PATH = '/api/auth/setup';

export type AuthFetchResult = {
  response: Response;
  url: string;
  method: string;
};

const LOGIN_RETRY_DELAY_MS = 250;
const TRANSIENT_LOGIN_STATUSES = new Set([502, 503, 504]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: init.credentials ?? 'include',
    cache: init.cache ?? 'no-store'
  });
}

/** Fetch for auth API routes. Uses the current app origin in browsers and the production app origin in native shells. */
export async function authApiFetch(path: string, init: RequestInit = {}): Promise<AuthFetchResult> {
  const url = resolveClientApiUrl(path);
  const method = (init.method || 'GET').toUpperCase();

  logAuthDebug('auth_fetch_start', { method, endpoint: path, requestedUrl: url });

  let response: Response;
  try {
    response = await runFetch(url, init);
  } catch (error) {
    if (path !== LOGIN_API_PATH) throw error;

    logAuthDebug('auth_fetch_retry', {
      method,
      endpoint: path,
      requestedUrl: url,
      reason: 'network_error'
    });
    await delay(LOGIN_RETRY_DELAY_MS);
    response = await runFetch(url, init);
  }

  if (path === LOGIN_API_PATH && TRANSIENT_LOGIN_STATUSES.has(response.status)) {
    logAuthDebug('auth_fetch_retry', {
      method,
      endpoint: path,
      requestedUrl: url,
      reason: `http_${response.status}`
    });
    await delay(LOGIN_RETRY_DELAY_MS);
    response = await runFetch(url, init);
  }

  logAuthDebug('auth_fetch_response', {
    method,
    endpoint: path,
    requestedUrl: url,
    status: response.status,
    ok: response.ok ? 1 : 0
  });

  return { response, url, method };
}
