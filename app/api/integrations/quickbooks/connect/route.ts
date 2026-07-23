import { NextResponse } from 'next/server';
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

export async function GET() {
  if (!quickbooksConfigured()) {
    return NextResponse.json({ error: quickbooksMissingCredentialsMessage() }, { status: 503 });
  }

  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!canManageOrganizationSettings(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  let state: string;
  try {
    state = createQuickBooksOAuthState(ctx.userId, ctx.workspace.organizationId);
  } catch {
    return NextResponse.json({ error: quickbooksMissingCredentialsMessage() }, { status: 503 });
  }

  return NextResponse.redirect(quickbooksOAuthAuthorizeUrl(state));
}
