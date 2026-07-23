import { NextResponse } from 'next/server';
import { QuickBooksApiError, syncCustomerToQuickBooks } from '@/lib/quickbooks';
import { quickbooksConfigured, quickbooksMissingCredentialsMessage } from '@/lib/quickbooks/config';
import { writeQuickBooksSyncLog } from '@/lib/quickbooks/logging';
import { isValidUuid } from '@/lib/input-validation';
import { isManagerRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  if (!isManagerRole(ctx.workspace.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as { customer_id?: string };
  const customerId = body.customer_id?.trim();
  if (!customerId || !isValidUuid(customerId)) {
    return NextResponse.json({ error: 'Valid customer id is required.' }, { status: 400 });
  }

  if (!quickbooksConfigured()) {
    await writeQuickBooksSyncLog(ctx.supabase, {
      organizationId: ctx.workspace.organizationId,
      userId: ctx.userId,
      entityType: 'customer',
      entityId: customerId,
      action: 'sync_customer',
      status: 'failed',
      errorMessage: quickbooksMissingCredentialsMessage()
    });
    return NextResponse.json({ error: quickbooksMissingCredentialsMessage() }, { status: 503 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 503 });
  }

  // Confirm the customer belongs to this organization using the user-scoped client first.
  const { data: customer } = await ctx.supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  }

  try {
    const result = await syncCustomerToQuickBooks({
      admin,
      organizationId: ctx.workspace.organizationId,
      userId: ctx.userId,
      customerId
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      updated: result.updated,
      externalId: result.externalId,
      message: result.created
        ? 'Customer created in QuickBooks.'
        : 'Customer updated in QuickBooks.'
    });
  } catch (error) {
    if (error instanceof QuickBooksApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.parsed.userMessage,
          reconnectRequired: error.parsed.reconnectRequired
        },
        { status: error.parsed.httpStatus >= 400 && error.parsed.httpStatus < 600 ? error.parsed.httpStatus : 400 }
      );
    }
    return NextResponse.json({ success: false, error: 'Customer sync failed.' }, { status: 500 });
  }
}
