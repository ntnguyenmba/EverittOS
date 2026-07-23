/**
 * QuickBooks Online helpers (server-only).
 * Prefer importing from `@/lib/quickbooks/*` for new code; this module re-exports
 * the public surface used by API routes and existing tests.
 */

export {
  QUICKBOOKS_CALLBACK_PATH,
  quickbooksRedirectUri,
  quickbooksEnvironment,
  quickbooksBaseUrl,
  quickbooksConfigured,
  quickbooksMissingCredentialsMessage,
  quickbooksOAuthAuthorizeUrl,
  type QuickBooksConnectionStatus,
  type QuickBooksEnvironment
} from '@/lib/quickbooks/config';

export {
  createQuickBooksOAuthState,
  verifyQuickBooksOAuthState,
  type QuickBooksOAuthStatePayload
} from '@/lib/quickbooks/oauth-state';

export {
  extractIntuitTid,
  parseQuickBooksError,
  escapeQuickBooksQueryValue
} from '@/lib/quickbooks/errors';

export {
  QuickBooksApiError,
  accessTokenNeedsRefresh,
  exchangeAuthorizationCode,
  refreshAccessToken,
  ensureValidAccessToken,
  loadQuickBooksConnection,
  persistConnectionTokens,
  revokeQuickBooksToken,
  quickbooksAccountingRequest,
  fetchCompanyDisplayName,
  tokenExpiryIso
} from '@/lib/quickbooks/client';

export { syncCustomerToQuickBooks, buildQuickBooksCustomerPayload } from '@/lib/quickbooks/customers';
export { exportInvoiceToQuickBooks, buildQuickBooksInvoicePayload } from '@/lib/quickbooks/invoices';
