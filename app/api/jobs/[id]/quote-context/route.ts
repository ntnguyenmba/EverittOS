import { NextResponse } from 'next/server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function optionalNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });

  const { id } = await context.params;
  const body = await request.json();
  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('id')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  const row = {
    quote_service_type: String(body.serviceType || '').trim() || null,
    quote_size_value: optionalNumber(body.sizeValue),
    quote_size_unit: String(body.sizeUnit || '').trim() || null,
    quote_primary_units: optionalNumber(body.primaryUnits),
    quote_extra_units: optionalNumber(body.extraUnits),
    quote_condition: String(body.condition || '').trim() || null,
    quote_frequency: String(body.frequency || '').trim() || null,
    quote_add_ons: Array.isArray(body.addOns) ? body.addOns.map(String).slice(0, 30) : [],
    quote_labor_hours: optionalNumber(body.laborHours),
    quote_price: optionalNumber(body.price),
    quote_currency: String(body.currency || '').trim().slice(0, 8) || null,
    quote_source_request: String(body.sourceRequest || '').trim().slice(0, 5000) || null,
    quote_created_at: new Date().toISOString(),
  };

  const { error } = await ctx.supabase
    .from('jobs')
    .update(row)
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId);

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: 'Quote context storage is not ready yet.', code: 'schema_update_required' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
