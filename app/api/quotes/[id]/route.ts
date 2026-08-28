import { NextResponse } from 'next/server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isAdminRole, normalizeRole } from '@/lib/roles';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = new Set(['draft', 'shared', 'accepted', 'declined', 'converted']);

function canUseQuotes(role: string | null | undefined) {
  return isAdminRole(normalizeRole(role));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  if (!canUseQuotes(ctx.workspace.role)) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json();
  const status = String(body.status || '').trim();
  if (!STATUSES.has(status)) return NextResponse.json({ error: 'Choose a valid quote status.' }, { status: 400 });

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
    if (isMissingSchemaError(error)) return NextResponse.json({ error: 'Saved quotes are not ready yet.', code: 'schema_update_required' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
  return NextResponse.json({ quote: data });
}
