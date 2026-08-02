import type { SupabaseClient } from '@supabase/supabase-js';
import {
  QUICKBOOKS_HTTP_TIMEOUT_MS,
  QUICKBOOKS_REVOKE_URL,
  QUICKBOOKS_TOKEN_REFRESH_SKEW_MS,
  QUICKBOOKS_TOKEN_URL,
  basicAuthHeader,
  quickbooksBaseUrl,
  quickbooksRedirectUri
} from '@/lib/quickbooks/config';
import { extractIntuitTid, parseQuickBooksError, type ParsedQuickBooksError } from '@/lib/quickbooks/errors';
import { logQuickBooksEvent } from '@/lib/quickbooks/logging';

export type QuickBooksConnectionRecord = {
  id: string;
  organization_id: string;
  status: string;
  realm_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  company_name: string | null;
  updated_at: string | null;
};

export type QuickBooksTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  x_refresh_token_expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export class QuickBooksApiError extends Error {
  readonly parsed: ParsedQuickBooksError;

  constructor(parsed: ParsedQuickBooksError) {
    super(parsed.userMessage);
    this.name = 'QuickBooksApiError';
    this.parsed = parsed;
  }
}

export type QuickBooksFetch = typeof fetch;

export type QuickBooksHttpResult<T = unknown> = {
  ok: boolean;
  status: number;
  body: T;
  intuitTid: string | null;
  headers: Headers;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false;
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function parseJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

export async function quickbooksHttp(
  url: string,
  init: RequestInit,
  options?: { fetchImpl?: QuickBooksFetch; timeoutMs?: number; maxAttempts?: number }
): Promise<QuickBooksHttpResult> {
  const fetchImpl = options?.fetchImpl || fetch;
  const timeoutMs = options?.timeoutMs ?? QUICKBOOKS_HTTP_TIMEOUT_MS;
  const maxAttempts = options?.maxAttempts ?? 3;
  let last: QuickBooksHttpResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { ...init, signal: controller.signal });
      const intuitTid = extractIntuitTid(res.headers);
      const body = await parseJsonBody(res);
      last = { ok: res.ok, status: res.status, body, intuitTid, headers: res.headers };

      if (res.ok || !shouldRetry(res.status, attempt, maxAttempts)) {
        return last;
      }

      logQuickBooksEvent('transient_retry', {
        status: res.status,
        attempt,
        intuitTid,
        urlHost: safeUrlHost(url)
      });
      await sleep(Math.min(1000 * 2 ** (attempt - 1), 4000));
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      if (attempt >= maxAttempts) {
        throw new QuickBooksApiError(
          parseQuickBooksError({
            httpStatus: aborted ? 504 : 500,
            body: { error: aborted ? 'timeout' : 'network_error' },
            intuitTid: null
          })
        );
      }
      await sleep(Math.min(1000 * 2 ** (attempt - 1), 4000));
    } finally {
      clearTimeout(timer);
    }
  }

  return last as QuickBooksHttpResult;
}

function safeUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

export async function loadQuickBooksConnection(
  admin: SupabaseClient,
  organizationId: string
): Promise<QuickBooksConnectionRecord | null> {
  const { data, error } = await admin
    .from('quickbooks_connections')
    .select(
      'id, organization_id, status, realm_id, access_token, refresh_token, token_expires_at, refresh_token_expires_at, last_sync_at, last_error, company_name, updated_at'
    )
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as QuickBooksConnectionRecord | null) || null;
}

export function accessTokenNeedsRefresh(connection: QuickBooksConnectionRecord, now = Date.now()): boolean {
  if (!connection.access_token) return true;
  if (!connection.token_expires_at) return false;
  const expiresAt = Date.parse(connection.token_expires_at);
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt - QUICKBOOKS_TOKEN_REFRESH_SKEW_MS <= now;
}

export async function exchangeAuthorizationCode(
  code: string,
  options?: { fetchImpl?: QuickBooksFetch }
): Promise<{ tokens: QuickBooksTokenResponse; intuitTid: string | null }> {
  const result = await quickbooksHttp(
    QUICKBOOKS_TOKEN_URL,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: quickbooksRedirectUri()
      })
    },
    { fetchImpl: options?.fetchImpl, maxAttempts: 1 }
  );

  const body = result.body as QuickBooksTokenResponse;
  if (!result.ok || !body.access_token) {
    throw new QuickBooksApiError(
      parseQuickBooksError({
        httpStatus: result.status,
        body,
        intuitTid: result.intuitTid,
        oauthError: body.error || null
      })
    );
  }

  logQuickBooksEvent('oauth_code_exchange_ok', { intuitTid: result.intuitTid, status: result.status });
  return { tokens: body, intuitTid: result.intuitTid };
}

export async function refreshAccessToken(
  refreshToken: string,
  options?: { fetchImpl?: QuickBooksFetch }
): Promise<{ tokens: QuickBooksTokenResponse; intuitTid: string | null }> {
  const result = await quickbooksHttp(
    QUICKBOOKS_TOKEN_URL,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    },
    { fetchImpl: options?.fetchImpl, maxAttempts: 1 }
  );

  const body = result.body as QuickBooksTokenResponse;
  if (!result.ok || !body.access_token) {
    throw new QuickBooksApiError(
      parseQuickBooksError({
        httpStatus: result.status,
        body,
        intuitTid: result.intuitTid,
        oauthError: body.error || null
      })
    );
  }

  logQuickBooksEvent('token_refresh_ok', { intuitTid: result.intuitTid, status: result.status });
  return { tokens: body, intuitTid: result.intuitTid };
}

export function tokenExpiryIso(expiresInSeconds?: number): string | null {
  if (!expiresInSeconds || !Number.isFinite(expiresInSeconds)) return null;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export async function persistConnectionTokens(
  admin: SupabaseClient,
  organizationId: string,
  tokens: QuickBooksTokenResponse,
  extra?: Partial<{
    realm_id: string | null;
    status: string;
    company_name: string | null;
    last_error: string | null;
  }>
): Promise<void> {
  const patch: Record<string, unknown> = {
    organization_id: organizationId,
    provider: 'quickbooks',
    status: extra?.status || 'connected',
    access_token: tokens.access_token,
    token_expires_at: tokenExpiryIso(tokens.expires_in),
    last_error: extra?.last_error ?? null,
    updated_at: new Date().toISOString()
  };

  if (tokens.refresh_token) {
    patch.refresh_token = tokens.refresh_token;
  }
  if (tokens.x_refresh_token_expires_in) {
    patch.refresh_token_expires_at = tokenExpiryIso(tokens.x_refresh_token_expires_in);
  }
  if (extra?.realm_id !== undefined) {
    patch.realm_id = extra.realm_id;
  }
  if (extra?.company_name !== undefined) {
    patch.company_name = extra.company_name;
  }

  const { error } = await admin.from('quickbooks_connections').upsert(patch, { onConflict: 'organization_id' });
  if (error) throw new Error(error.message);
}

export async function markConnectionReconnectRequired(
  admin: SupabaseClient,
  organizationId: string,
  message: string
): Promise<void> {
  const { error } = await admin
    .from('quickbooks_connections')
    .update({
      status: 'error',
      last_error: message,
      access_token: null,
      updated_at: new Date().toISOString()
    })
    .eq('organization_id', organizationId);

  if (error) {
    console.error('[quickbooks] failed to mark reconnect required', { organizationId, message: error.message });
  }
}

export async function ensureValidAccessToken(
  admin: SupabaseClient,
  connection: QuickBooksConnectionRecord,
  options?: { fetchImpl?: QuickBooksFetch }
): Promise<{ accessToken: string; realmId: string; connection: QuickBooksConnectionRecord }> {
  if (!connection.realm_id) {
    throw new QuickBooksApiError(
      parseQuickBooksError({
        httpStatus: 400,
        body: { error: 'missing_realm' },
        intuitTid: null
      })
    );
  }

  if (!['connected', 'syncing', 'error'].includes(connection.status)) {
    throw new QuickBooksApiError({
      userMessage: 'Connect QuickBooks before syncing.',
      httpStatus: 400,
      intuitTid: null,
      reconnectRequired: true,
      retryable: false,
      code: 'not_connected'
    });
  }

  if (!accessTokenNeedsRefresh(connection)) {
    if (!connection.access_token) {
      throw new QuickBooksApiError({
        userMessage: 'QuickBooks access expired. Disconnect and connect again in Settings.',
        httpStatus: 401,
        intuitTid: null,
        reconnectRequired: true,
        retryable: false,
        code: 'missing_access_token'
      });
    }
    return { accessToken: connection.access_token, realmId: connection.realm_id, connection };
  }

  if (!connection.refresh_token) {
    await markConnectionReconnectRequired(
      admin,
      connection.organization_id,
      'Refresh token missing. Reconnect QuickBooks.'
    );
    throw new QuickBooksApiError({
      userMessage: 'QuickBooks access expired. Disconnect and connect again in Settings.',
      httpStatus: 401,
      intuitTid: null,
      reconnectRequired: true,
      retryable: false,
      code: 'missing_refresh_token'
    });
  }

  try {
    const { tokens } = await refreshAccessToken(connection.refresh_token, options);
    await persistConnectionTokens(admin, connection.organization_id, tokens, {
      realm_id: connection.realm_id,
      status: connection.status === 'syncing' ? 'syncing' : 'connected',
      company_name: connection.company_name,
      last_error: null
    });

    const refreshed = await loadQuickBooksConnection(admin, connection.organization_id);
    if (!refreshed?.access_token || !refreshed.realm_id) {
      throw new Error('Token refresh succeeded but connection could not be reloaded.');
    }
    return { accessToken: refreshed.access_token, realmId: refreshed.realm_id, connection: refreshed };
  } catch (error) {
    if (error instanceof QuickBooksApiError && error.parsed.reconnectRequired) {
      await markConnectionReconnectRequired(admin, connection.organization_id, error.parsed.userMessage);
    }
    throw error;
  }
}

export async function quickbooksAccountingRequest<T = unknown>(
  input: {
    admin: SupabaseClient;
    organizationId: string;
    method: 'GET' | 'POST';
    path: string;
    query?: Record<string, string>;
    body?: unknown;
    fetchImpl?: QuickBooksFetch;
    connection?: QuickBooksConnectionRecord | null;
  }
): Promise<QuickBooksHttpResult<T>> {
  let connection = input.connection || (await loadQuickBooksConnection(input.admin, input.organizationId));
  if (!connection || !['connected', 'syncing', 'error'].includes(connection.status)) {
    throw new QuickBooksApiError({
      userMessage: 'Connect QuickBooks before syncing.',
      httpStatus: 400,
      intuitTid: null,
      reconnectRequired: true,
      retryable: false,
      code: 'not_connected'
    });
  }

  const ensured = await ensureValidAccessToken(input.admin, connection, { fetchImpl: input.fetchImpl });
  connection = ensured.connection;

  const url = new URL(`${quickbooksBaseUrl()}/v3/company/${ensured.realmId}${input.path}`);
  url.searchParams.set('minorversion', '65');
  if (input.query) {
    for (const [key, value] of Object.entries(input.query)) {
      url.searchParams.set(key, value);
    }
  }

  const result = await quickbooksHttp(
    url.toString(),
    {
      method: input.method,
      headers: {
        Authorization: `Bearer ${ensured.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body)
    },
    { fetchImpl: input.fetchImpl }
  );

  logQuickBooksEvent('accounting_response', {
    organizationId: input.organizationId,
    method: input.method,
    path: input.path,
    status: result.status,
    intuitTid: result.intuitTid,
    ok: result.ok
  });

  if (!result.ok) {
    const parsed = parseQuickBooksError({
      httpStatus: result.status,
      body: result.body,
      intuitTid: result.intuitTid
    });
    if (parsed.reconnectRequired) {
      await markConnectionReconnectRequired(input.admin, input.organizationId, parsed.userMessage);
    }
    throw new QuickBooksApiError(parsed);
  }

  return result as QuickBooksHttpResult<T>;
}

export async function revokeQuickBooksToken(
  token: string,
  options?: { fetchImpl?: QuickBooksFetch }
): Promise<{ ok: boolean; intuitTid: string | null; status: number }> {
  const result = await quickbooksHttp(
    QUICKBOOKS_REVOKE_URL,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ token })
    },
    { fetchImpl: options?.fetchImpl, maxAttempts: 1 }
  );

  logQuickBooksEvent('token_revoke', {
    status: result.status,
    intuitTid: result.intuitTid,
    ok: result.ok
  });

  return { ok: result.ok || result.status === 200, intuitTid: result.intuitTid, status: result.status };
}

export async function fetchCompanyDisplayName(
  admin: SupabaseClient,
  organizationId: string,
  options?: { fetchImpl?: QuickBooksFetch; connection?: QuickBooksConnectionRecord | null }
): Promise<string | null> {
  try {
    const connection =
      options?.connection || (await loadQuickBooksConnection(admin, organizationId));
    if (!connection?.realm_id) return null;

    const result = await quickbooksAccountingRequest<{
      CompanyInfo?: { CompanyName?: string };
    }>({
      admin,
      organizationId,
      method: 'GET',
      path: `/companyinfo/${encodeURIComponent(connection.realm_id)}`,
      fetchImpl: options?.fetchImpl,
      connection
    });
    return result.body.CompanyInfo?.CompanyName || null;
  } catch {
    return null;
  }
}
