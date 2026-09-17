import { NextResponse } from 'next/server';
import { isManagerRole } from '@/lib/roles';
import { isValidUuid } from '@/lib/input-validation';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getMiscApiCopy } from '@/lib/i18n/misc-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const c = getMiscApiCopy(localeFromRequest(request));
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!isManagerRole(ctx.workspace.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const { id } = await context.params;
  if (!isValidUuid(id)) return NextResponse.json({ error: c.invalidRouteId }, { status: 400 });

  const { data, error } = await ctx.supabase.from('route_optimization_runs').select('*').eq('id', id).eq('organization_id', ctx.workspace.organizationId).maybeSingle();
  if (error) return NextResponse.json({ error: c.loadRoute }, { status: 400 });
  if (!data) return NextResponse.json({ error: c.routeNotFound }, { status: 404 });

  return NextResponse.json({ run: data });
}
