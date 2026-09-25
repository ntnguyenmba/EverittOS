import { NextResponse } from 'next/server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isAdminRole, normalizeRole } from '@/lib/roles';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getResourceApiCopy } from '@/lib/i18n/resource-api-copy';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = new Set(['draft', 'shared', 'accepted', 'declined', 'converted']);

function canUseQuotes(role: string | null | undefined) {
  return isAdminRole(normalizeRole(role));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const c=getResourceApiCopy(localeFromRequest(request));
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  if (!canUseQuotes(ctx.workspace.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const { id } = await context.params;
  const { data, error } = await ctx.supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: c.quoteSchema, code: 'schema_update_required' }, { status: 409 });
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: c.loadQuotes }, { status: 404 });
  return NextResponse.json({ quote: data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const c=getResourceApiCopy(localeFromRequest(request));
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  if (!canUseQuotes(ctx.workspace.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json();
  const status = String(body.status || '').trim();
  if (!STATUSES.has(status)) return NextResponse.json({ error: c.loadQuotes }, { status: 400 });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: now };
  if (status === 'shared') patch.shared_at = now;
  if (status === 'accepted') patch.accepted_at = now;
  if (status === 'declined') patch.declined_at = now;
  if (status === 'converted') {
    patch.converted_at = now;
    patch.job_id = String(body.jobId || '').trim() || null;
  }

  const { data, error } = await ctx.supabase
    .from('quotes')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', ctx.workspace.organizationId)
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: c.quoteSchema, code: 'schema_update_required' }, { status: 409 });
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: c.loadQuotes }, { status: 404 });
  return NextResponse.json({ quote: data });
}
