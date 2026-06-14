import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import {
  assertBookingInsertResult,
  BOOKING_LIST_SELECT,
  upcomingBookingCutoffIso
} from '@/lib/booking/list-query';
import { mapBookingApiError, probeBookingSchemaReady, validateBookingTimeRange } from '@/lib/booking/schema';
import { parseManualBookingInput } from '@/lib/booking/parse-manual-booking';
import { processBookingSideEffects } from '@/lib/booking/process-side-effects';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bookingErrorResponse(message: string, fallback: string, status = 400) {
  const mapped = mapBookingApiError(message, fallback);
  return NextResponse.json(mapped, { status: mapped.code === 'schema_missing' ? 503 : status });
}

function applyWorkspaceScope<T extends { or: (filters: string) => T }>(
  query: T,
  workspaceId: string
): T {
  return query.or(`organization_id.eq.${workspaceId},workspace_id.eq.${workspaceId}`);
}

async function loadWorkspaceContact(admin: NonNullable<ReturnType<typeof createAdminSupabase>>, orgId: string) {
  const { data: settings } = await admin
    .from('organization_settings')
    .select('timezone, company_phone, company_email')
    .eq('organization_id', orgId)
    .maybeSingle();
  return settings;
}

export async function GET(request: Request) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const workspaceId = ctx.workspace.organizationId;
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'No active workspace found. Select or create a workspace before viewing bookings.', code: 'no_workspace' },
      { status: 403 }
    );
  }

  const schema = await probeBookingSchemaReady(ctx.supabase);
  if (!schema.ready) {
    return NextResponse.json(
      {
        schemaReady: false,
        code: schema.code,
        missing: schema.missing,
        error: schema.error,
        bookings: []
      },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const upcoming = url.searchParams.get('upcoming') === '1';

  let query = applyWorkspaceScope(
    ctx.supabase.from('bookings').select(BOOKING_LIST_SELECT),
    workspaceId
  ).order('starts_at', { ascending: true });

  if (upcoming) {
    query = query
      .gte('ends_at', upcomingBookingCutoffIso())
      .not('status', 'eq', 'cancelled');
  }

  const { data, error } = await query.limit(100);

  if (error) {
    return bookingErrorResponse(error.message, 'Unable to load bookings.');
  }

  return NextResponse.json({
    schemaReady: true,
    workspaceId,
    bookings: data || []
  });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const workspaceId = ctx.workspace.organizationId;
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'No active workspace found. Select or create a workspace before saving bookings.', code: 'no_workspace' },
      { status: 403 }
    );
  }

  const body = (await request.json()) as Record<string, unknown>;
  const parsed = parseManualBookingInput(body as Parameters<typeof parseManualBookingInput>[0]);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const schema = await probeBookingSchemaReady(ctx.supabase);
  if (!schema.ready) {
    return NextResponse.json(
      { code: schema.code, error: schema.error, schemaReady: false },
      { status: 503 }
    );
  }

  const timeError = validateBookingTimeRange(parsed.startsAt, parsed.endsAt);
  if (timeError) {
    return NextResponse.json({ error: timeError }, { status: 400 });
  }

  const admin = createAdminSupabase();

  const { data, error } = await ctx.supabase
    .from('bookings')
    .insert({
      organization_id: workspaceId,
      workspace_id: workspaceId,
      service_id: parsed.serviceId,
      manual_service_name: parsed.manualServiceName,
      worker_id: parsed.workerId,
      staff_name: parsed.staffName,
      client_name: parsed.clientName,
      client_email: parsed.clientEmail,
      client_phone: parsed.clientPhone,
      starts_at: parsed.startsAt,
      ends_at: parsed.endsAt,
      notes: parsed.notes,
      status: parsed.status,
      source: 'manual'
    })
    .select(BOOKING_LIST_SELECT)
    .single();

  if (error) {
    const mapped = mapBookingApiError(error.message, 'Unable to save booking.');
    if (mapped.code === 'schema_missing') {
      return NextResponse.json(mapped, { status: 503 });
    }
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  if (!assertBookingInsertResult(data)) {
    console.error('[bookings] insert returned no row', { workspaceId, startsAt: parsed.startsAt });
    return NextResponse.json(
      { error: 'Booking could not be saved. Supabase did not return the new booking row.', code: 'insert_no_row' },
      { status: 500 }
    );
  }

  await logWorkspaceActivity(workspaceId, ctx.userId, 'booking', data.id, 'booking_created', `Booking created for ${data.client_name}`);

  const warnings: string[] = [];
  let confirmationSent = false;

  if (admin) {
    const settings = await loadWorkspaceContact(admin, workspaceId);
    const sideEffects = await processBookingSideEffects(admin, {
      organizationId: workspaceId,
      organizationName: ctx.workspace.organizationName,
      timezone: settings?.timezone || 'America/New_York',
      booking: data as unknown as Parameters<typeof processBookingSideEffects>[1]['booking'],
      sourceLabel: 'Manual booking',
      sendCustomerConfirmation: parsed.sendConfirmation,
      contactEmail: settings?.company_email || null,
      contactPhone: settings?.company_phone || null
    });
    warnings.push(...sideEffects.warnings);
    confirmationSent = sideEffects.confirmationSent;
    if (sideEffects.calendarEventId) {
      data.google_calendar_event_id = sideEffects.calendarEventId;
    }
  }

  return NextResponse.json({
    ok: true,
    booking: data,
    workspaceId,
    message: 'Booking saved.',
    warnings,
    confirmationSent
  });
}
