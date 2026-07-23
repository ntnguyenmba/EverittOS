import { appOrigin, appUrl } from '@/lib/app-url';

export type QuickBooksConnectionStatus = 'disconnected' | 'connected' | 'error';

const QUICKBOOKS_CALLBACK_PATH = '/api/integrations/quickbooks/callback';

/**
 * Return one canonical callback URI for both the authorization request and
 * authorization-code exchange. A stale deployment URL in an environment
 * variable previously caused Intuit's redirect_uri mismatch error.
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

export function quickbooksConfigured(): boolean {
  return Boolean(
    process.env.QUICKBOOKS_CLIENT_ID?.trim() &&
      process.env.QUICKBOOKS_CLIENT_SECRET?.trim()
  );
}

export function quickbooksBaseUrl(): string {
  const env = (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox').toLowerCase();
  return env === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
}

export function quickbooksOAuthAuthorizeUrl(state: string): string {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!.trim();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: quickbooksRedirectUri(),
    state
  });
  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}

export function quickbooksMissingCredentialsMessage(): string {
  return 'QuickBooks is not configured on this server. Add QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET to your environment.';
}
