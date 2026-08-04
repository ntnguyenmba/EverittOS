import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';
import { isValidUuid } from '@/lib/input-validation';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import { mapWorkspaceSaveError, workspaceScopedFields } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isValidTimeZone } from '@/lib/time-zones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Creates a draft job copied from a past job.
 * Does not copy completion, payment, invoice, photos, signatures, or notifications.
 */
export async function POST(_request: Request, context: RouteContext) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid job id.' }, { status: 400 });
  }

  const planCheck = await enforcePlanForUser(ctx.supabase, ctx.userId, 'jobs');
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.message || 'Plan limit reached.' }, { status: 403 });
  }

  const sourceColumns =
    'id, user_id, organization_id, title, customer_name, phone, address, notes, customer_id, property_id, timezone, service_type, assigned_to, location_name, price_estimate';

  // Read through the signed-in user's existing row access first. Older jobs can have a null
  // organization_id, so filtering by the current workspace before reading incorrectly returns
  // "Job not found" even though the owner can open the job in the app.
  const { data: source, error: sourceError } = await ctx.supabase
    .from('jobs')
    .select(sourceColumns)
    .eq('id', id)
    .maybeSingle();

  if (
    sourceError ||
    !source ||
    (source.organization_id && source.organization_id !== ctx.workspace.organizationId)
  ) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  let propertyDefaults: {
    access_instructions?: string | null;
    supply_notes?: string | null;
    default_price?: number | null;
    default_duration_minutes?: number | null;
    preferred_contractor_id?: string | null;
    timezone?: string | null;
    formatted_address?: string | null;
    address?: string | null;
  } | null = null;

  if (source.property_id) {
    const { data: property } = await ctx.supabase
      .from('customer_properties')
      .select(
        'access_instructions, supply_notes, default_price, default_duration_minutes, preferred_contractor_id, timezone, formatted_address, address'
      )
      .eq('id', source.property_id)
      .eq('organization_id', ctx.workspace.organizationId)
      .maybeSingle();
    propertyDefaults = property;
  }

  const timezone =
    (source.timezone && isValidTimeZone(source.timezone) && source.timezone) ||
    (propertyDefaults?.timezone && isValidTimeZone(propertyDefaults.timezone) && propertyDefaults.timezone) ||
    null;

  const notesParts = [
    source.notes?.trim() || null,
    propertyDefaults?.access_instructions?.trim()
      ? `Access: ${propertyDefaults.access_instructions.trim()}`
      : null,
    propertyDefaults?.supply_notes?.trim() ? `Supplies: ${propertyDefaults.supply_notes.trim()}` : null
  ].filter(Boolean);

  const insertPayload: Record<string, unknown> = {
    ...workspaceScopedFields(ctx.workspace, ctx.userId),
    title: source.title,
    customer_name: source.customer_name,
    phone: source.phone,
    address: source.address || propertyDefaults?.formatted_address || propertyDefaults?.address || null,
    notes: notesParts.length ? notesParts.join('\n\n') : null,
    customer_id: source.customer_id,
    property_id: source.property_id,
    timezone,
    service_type: source.service_type || null,
    location_name: source.location_name || null,
    price_estimate: source.price_estimate ?? propertyDefaults?.default_price ?? null,
    assigned_to: null,
    status: 'new',
    start_date: null,
    due_date: null,
    scheduled_start: null,
    scheduled_end: null,
    completed_at: null,
    completion_notes: null
  };

  const { data: created, error } = await ctx.supabase
    .from('jobs')
    .insert(insertPayload)
    .select('id, title, customer_id, property_id, timezone, status')
    .single();

  if (error) {
    if (isMissingSchemaError(error) && String(error.message || '').includes('property_id')) {
      delete insertPayload.property_id;
      const retry = await ctx.supabase
        .from('jobs')
        .insert(insertPayload)
        .select('id, title, customer_id, timezone, status')
        .single();
      if (retry.error || !retry.data) {
        return NextResponse.json({ error: mapWorkspaceSaveError(retry.error?.message || error.message) }, { status: 400 });
      }
      return NextResponse.json({
        job: retry.data,
        redirectTo: `/jobs/${retry.data.id}?confirmSchedule=1`,
        requiresScheduleConfirmation: true,
        message: 'Draft job created. Confirm the date and time before scheduling.'
      });
    }
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });
  }

  // Copy checklist item labels only (not completion state).
  const checklistQuery = ctx.supabase
    .from('job_checklist_items')
    .select('label, sort_order')
    .eq('job_id', id)
    .order('sort_order', { ascending: true });
  const { data: checklist } = source.organization_id
    ? await checklistQuery.eq('organization_id', ctx.workspace.organizationId)
    : await checklistQuery;

  if (checklist?.length) {
    await ctx.supabase.from('job_checklist_items').insert(
      checklist.map((item, index) => ({
        organization_id: ctx.workspace.organizationId,
        job_id: created.id,
        user_id: ctx.userId,
        label: item.label,
        completed: false,
        sort_order: item.sort_order ?? index
      }))
    );
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    'job',
    created.id,
    'job_duplicated',
    `Draft job created from ${source.title}`,
    { sourceJobId: id }
  );

  return NextResponse.json({
    job: created,
    requiresScheduleConfirmation: true,
    message: 'Draft job created. Confirm the date and time before scheduling.',
    redirectTo: `/jobs/${created.id}?confirmSchedule=1`
  });
}
