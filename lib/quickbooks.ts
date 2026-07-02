import { appUrl } from '@/lib/app-url';

export type QuickBooksConnectionStatus = 'disconnected' | 'connected' | 'error';

export function quickbooksConfigured(): boolean {
  return Boolean(
    process.env.QUICKBOOKS_CLIENT_ID?.trim() &&
      process.env.QUICKBOOKS_CLIENT_SECRET?.trim() &&
      (process.env.QUICKBOOKS_REDIRECT_URI?.trim() || appUrl('/api/integrations/quickbooks/callback'))
  );
}

export function quickbooksBaseUrl(): string {
  const env = (process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox').toLowerCase();
  return env === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
}

export function quickbooksOAuthAuthorizeUrl(state: string): string {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!.trim();
  const redirectUri = (process.env.QUICKBOOKS_REDIRECT_URI || appUrl('/api/integrations/quickbooks/callback')).trim();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    state
  });
  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}

export function quickbooksMissingCredentialsMessage(): string {
  return 'QuickBooks is not configured on this server. Add QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, and QUICKBOOKS_REDIRECT_URI to your environment.';
}
