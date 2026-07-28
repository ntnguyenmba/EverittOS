import { NextRequest, NextResponse } from 'next/server';
import {
  createQuickBooksOAuthState,
  quickbooksConfigured,
  quickbooksMissingCredentialsMessage,
  quickbooksOAuthAuthorizeUrl
} from '@/lib/quickbooks';
import { canManageOrganizationSettings } from '@/lib/roles';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const SESSION_TIMEOUT_MS = 8000;

class ConnectTimeoutError extends Error {
  constructor() {
    super('QuickBooks workspace session timed out');
    this.name = 'ConnectTimeoutError';
  }
}

async function withTimeout<T>(promise: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new ConnectTimeoutError()), SESSION_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function paymentsRedirect(request: NextRequest, reason: string, detail?: string) {
  const url = new URL('/invoices', request.url);
  url.searchParams.set('quickbooks', 'error');
  url.searchParams.set('reason', reason);
  if (detail) url.searchParams.set('detail', detail.slice(0, 180));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  try {
    if (!quickbooksConfigured()) {
      return paymentsRedirect(request, 'not_configured', quickbooksMissingCredentialsMessage());
    }

    const ctx = await withTimeout(requireWorkspaceSession());
    if (!ctx.ok) {
      if (ctx.status === 401) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('next', '/invoices');
        return NextResponse.redirect(loginUrl);
      }
      return paymentsRedirect(request, 'workspace_session_failed', ctx.error);
    }

    if (!canManageOrganizationSettings(ctx.workspace.role)) {
      return paymentsRedirect(request, 'permission_denied', 'Only workspace owners and admins can connect QuickBooks.');
    }

    let state: string;
    try {
      state = createQuickBooksOAuthState(ctx.userId, ctx.workspace.organizationId);
    } catch (error) {
      console.error('QuickBooks OAuth state creation failed', error);
      return paymentsRedirect(request, 'state_creation_failed', quickbooksMissingCredentialsMessage());
    }

    let authorizeUrl: string;
    try {
      authorizeUrl = quickbooksOAuthAuthorizeUrl(state);
    } catch (error) {
      console.error('QuickBooks authorize URL creation failed', error);
      return paymentsRedirect(request, 'authorize_url_failed', 'QuickBooks OAuth settings are incomplete.');
    }

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const timedOut = error instanceof ConnectTimeoutError;
    console.error('QuickBooks connect route failed', error);
    return paymentsRedirect(
      request,
      timedOut ? 'session_timeout' : 'connect_failed',
      timedOut ? 'The workspace session check took too long. Please try again.' : 'QuickBooks connection could not be started.'
    );
  }
}
