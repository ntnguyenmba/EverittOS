import { NextResponse } from 'next/server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { data, error } = await ctx.supabase.from('organization_settings').select('review_url').eq('organization_id', ctx.workspace.organizationId).maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ reviewUrl: '', schemaReady: false });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ reviewUrl: String(data?.review_url || ''), schemaReady: true });
}

export async function PATCH(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const body = (await request.json().catch(() => ({}))) as { reviewUrl?: string };
  const reviewUrl = body.reviewUrl?.trim() || null;
  if (reviewUrl) {
    try {
      const parsed = new URL(reviewUrl);
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('invalid');
    } catch {
      return NextResponse.json({ error: 'Enter a valid review URL.' }, { status: 400 });
    }
  }
  const { error } = await ctx.supabase.from('organization_settings').upsert({ organization_id: ctx.workspace.organizationId, review_url: reviewUrl });
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: 'Review URL storage is not set up yet. Run the latest Supabase migration.' }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, reviewUrl: reviewUrl || '' });
}
