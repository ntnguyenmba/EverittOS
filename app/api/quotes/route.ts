import { NextResponse } from 'next/server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isAdminRole, normalizeRole } from '@/lib/roles';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getResourceApiCopy } from '@/lib/i18n/resource-api-copy';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { normalizePlan } from '@/lib/everittos-plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function canUseQuotes(role: string | null | undefined) { return isAdminRole(normalizeRole(role)); }
function optionalNumber(value: unknown) { if (value === '' || value === null || value === undefined) return null; const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : null; }

export async function GET(request:Request) {
  const c=getResourceApiCopy(localeFromRequest(request));
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  if (!canUseQuotes(ctx.workspace.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  const { data, error } = await ctx.supabase.from('quotes').select('*').eq('organization_id', ctx.workspace.organizationId).order('created_at', { ascending: false }).limit(100);
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ quotes: [], schemaReady: false });
    return NextResponse.json({ error: c.loadQuotes }, { status: 400 });
  }
  return NextResponse.json({ quotes: data || [], schemaReady: true });
}

export async function POST(request: Request) {
  const c=getResourceApiCopy(localeFromRequest(request));
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  if (!canUseQuotes(ctx.workspace.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  const body = await request.json();
  const resolvedPlan = normalizePlan((await resolveOrganizationPlan(ctx.supabase, ctx.userId, ctx.workspace.organizationId)).plan);
  if (resolvedPlan === 'free') {
    const { count, error: countError } = await ctx.supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.workspace.organizationId);
    if (countError) return NextResponse.json({ error: c.loadQuotes }, { status: 400 });
    if ((count || 0) >= 3) return NextResponse.json({ error: 'free_quote_limit', code: 'free_quote_limit', requiredPlan: 'pro' }, { status: 403 });
  }
  const price = optionalNumber(body.price);
  if (price === null) return NextResponse.json({ error: c.quotePrice }, { status: 400 });
  const row = { organization_id: ctx.workspace.organizationId, created_by: ctx.userId, customer_id: String(body.customerId || '').trim() || null, status: 'draft', service_type: String(body.serviceType || '').trim() || null, size_value: optionalNumber(body.sizeValue), size_unit: String(body.sizeUnit || '').trim() || null, primary_units: optionalNumber(body.primaryUnits), extra_units: optionalNumber(body.extraUnits), condition: String(body.condition || '').trim() || null, frequency: String(body.frequency || '').trim() || null, add_ons: Array.isArray(body.addOns) ? body.addOns.map(String).slice(0, 30) : [], labor_hours: optionalNumber(body.laborHours), price, currency: String(body.currency || 'USD').trim().slice(0, 8) || 'USD', source_request: String(body.sourceRequest || '').trim().slice(0, 5000) || null, customer_name: String(body.customerName || '').trim().slice(0, 200) || null, customer_email: String(body.customerEmail || '').trim().slice(0, 320) || null, customer_phone: String(body.customerPhone || '').trim().slice(0, 80) || null, notes: String(body.notes || '').trim().slice(0, 5000) || null };
  const { data, error } = await ctx.supabase.from('quotes').insert(row).select('*').single();
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: c.quoteSchema, code: 'schema_update_required' }, { status: 409 });
    return NextResponse.json({ error: c.loadQuotes }, { status: 400 });
  }
  return NextResponse.json({ quote: data }, { status: 201 });
}
