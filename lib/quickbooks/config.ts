import { appOrigin, appUrl } from '@/lib/app-url';

export const QUICKBOOKS_CALLBACK_PATH = '/api/integrations/quickbooks/callback';
export const QUICKBOOKS_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
export const QUICKBOOKS_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
export const QUICKBOOKS_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
export const QUICKBOOKS_STATE_MAX_AGE_MS = 10 * 60 * 1000;
export const QUICKBOOKS_TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000;
export const QUICKBOOKS_HTTP_TIMEOUT_MS = 25_000;

export type QuickBooksEnvironment = 'sandbox' | 'production';
export type QuickBooksConnectionStatus = 'disconnected' | 'connected' | 'error';

/**
 * Canonical callback URI for both authorization and token exchange.
 * Must match Intuit app settings exactly.
 */
export function quickbooksRedirectUri(): string {
  const fallback = appUrl(QUICKBOOKS_CALLBACK_PATH);
  const configured = process.env.QUICKBOOKS_REDIRECT_URI?.trim();

  if (!configured) return fallback;

  try {
    const url = new URL(configured);
    const expectedOrigin = appOrigin();

    if (
      url.protocol !== 'https:' ||
      url.origin !== expectedOrigin ||
      url.pathname.replace(/\/$/, '') !== QUICKBOOKS_CALLBACK_PATH
    ) {
      return fallback;
    }

    return `${url.origin}${QUICKBOOKS_CALLBACK_PATH}`;
  } catch {
    return fallback;
  }
}

export function quickbooksEnvironment(): QuickBooksEnvironment {
  const env = (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox').trim().toLowerCase();
  return env === 'production' ? 'production' : 'sandbox';
}

export function quickbooksBaseUrl(): string {
  return quickbooksEnvironment() === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

export function quickbooksClientId(): string {
  return process.env.QUICKBOOKS_CLIENT_ID?.trim() || '';
}

export function quickbooksClientSecret(): string {
  return process.env.QUICKBOOKS_CLIENT_SECRET?.trim() || '';
}

export function quickbooksStateSecret(): string {
  return process.env.QUICKBOOKS_STATE_SECRET?.trim() || '';
}

export function quickbooksConfigured(): boolean {
  return Boolean(quickbooksClientId() && quickbooksClientSecret() && quickbooksStateSecret());
}

export function quickbooksMissingCredentialsMessage(): string {
  return 'QuickBooks is not configured on this server. Add QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, and QUICKBOOKS_STATE_SECRET to your environment.';
}

export function quickbooksOAuthAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: quickbooksClientId(),
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: quickbooksRedirectUri(),
    state
  });
  return `${QUICKBOOKS_AUTHORIZE_URL}?${params.toString()}`;
}

export function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${quickbooksClientId()}:${quickbooksClientSecret()}`).toString('base64')}`;
}
