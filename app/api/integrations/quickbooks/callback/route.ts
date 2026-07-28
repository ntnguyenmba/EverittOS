import { NextResponse } from 'next/server';
import { appUrl } from '@/lib/app-url';
import {
  exchangeAuthorizationCode,
  fetchCompanyDisplayName,
  persistConnectionTokens,
  quickbooksConfigured,
  verifyQuickBooksOAuthState
} from '@/lib/quickbooks';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { writeQuickBooksSyncLog, logQuickBooksEvent } from '@/lib/quickbooks/logging';
import { QuickBooksApiError, loadQuickBooksConnection } from '@/lib/quickbooks/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectWithError(code: string) {
  return NextResponse.redirect(appUrl(`/invoices?quickbooks=error&reason=${code}`));
}

export async function GET(request: Request) {
  if (!quickbooksConfigured()) {
    return redirectWithError('not_configured');
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const realmId = url.searchParams.get('realmId');

  if (!code || !state) {
    return redirectWithError('missing_code');
  }

  const parsed = verifyQuickBooksOAuthState(state);
  if (!parsed?.organizationId || !parsed.userId) {
    return redirectWithError('invalid_state');
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return redirectWithError('server_config');
  }

  try {
    const { tokens, intuitTid } = await exchangeAuthorizationCode(code);
    await persistConnectionTokens(admin, parsed.organizationId, tokens, {
      realm_id: realmId,
      status: 'connected',
      last_error: null
    });

    const connection = await loadQuickBooksConnection(admin, parsed.organizationId);
    const companyName = connection
      ? await fetchCompanyDisplayName(admin, parsed.organizationId, { connection })
      : null;

    if (companyName) {
      await admin
        .from('quickbooks_connections')
        .update({ company_name: companyName, updated_at: new Date().toISOString() })
        .eq('organization_id', parsed.organizationId);
    }

    await writeQuickBooksSyncLog(admin, {
      organizationId: parsed.organizationId,
      userId: parsed.userId,
      entityType: 'connection',
      action: 'connect',
      status: 'completed',
      externalId: realmId,
      intuitTid,
      httpStatus: 200
    });

    logQuickBooksEvent('oauth_connected', {
      organizationId: parsed.organizationId,
      realmId,
      intuitTid,
      hasCompanyName: Boolean(companyName)
    });

    return NextResponse.redirect(appUrl('/invoices?quickbooks=connected'));
  } catch (error) {
    const message =
      error instanceof QuickBooksApiError
        ? error.parsed.userMessage
        : 'QuickBooks connection failed.';
    const intuitTid = error instanceof QuickBooksApiError ? error.parsed.intuitTid : null;

    await writeQuickBooksSyncLog(admin, {
      organizationId: parsed.organizationId,
      userId: parsed.userId,
      entityType: 'connection',
      action: 'connect',
      status: 'failed',
      errorMessage: message,
      intuitTid,
      httpStatus: error instanceof QuickBooksApiError ? error.parsed.httpStatus : 500,
      qbErrorCode: error instanceof QuickBooksApiError ? error.parsed.code || null : null
    });

    logQuickBooksEvent('oauth_connect_failed', {
      organizationId: parsed.organizationId,
      intuitTid,
      reason: message
    });

    return redirectWithError('connect_failed');
  }
}
