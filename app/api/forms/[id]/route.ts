import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { fetchOrganizationContextWithRepair, mapWorkspaceSaveError } from '@/lib/workspace-server';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getFormApiCopy } from '@/lib/i18n/form-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ id: string }> };

async function contextForRequest() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, org: null };
  const org = await fetchOrganizationContextWithRepair(supabase, user.id, { email: user.email || '', userMetadata: user.user_metadata || undefined });
  return { supabase, user, org };
}

export async function GET(request: Request, context: RouteContext) {
  const c = getFormApiCopy(localeFromRequest(request));
  const { id } = await context.params;
  const { supabase, user, org } = await contextForRequest();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  if (!org) return NextResponse.json({ error: c.organizationNotFound }, { status: 404 });
  const { data: form, error } = await supabase.from('everitt_forms').select('*, everitt_form_fields(*)').eq('id', id).eq('organization_id', org.organizationId).maybeSingle();
  if (error) return NextResponse.json({ error: c.loadForm }, { status: 500 });
  if (!form) return NextResponse.json({ error: c.notFound }, { status: 404 });
  return NextResponse.json({ form });
}

export async function PATCH(request: Request, context: RouteContext) {
  const c = getFormApiCopy(localeFromRequest(request));
  const { id } = await context.params;
  const { supabase, user, org } = await contextForRequest();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  const body = (await request.json()) as { name?: string; active?: boolean; description?: string; settings?: Record<string, unknown> };
  const { data, error } = await supabase.from('everitt_forms').update({
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.active !== undefined ? { active: body.active } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.settings !== undefined ? { settings: body.settings } : {}),
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('organization_id', org.organizationId).select('*').single();
  if (error) return NextResponse.json({ error: mapWorkspaceSaveError(error.message, c.saveForm) }, { status: 400 });
  await logActivityServer({ organizationId: org.organizationId, userId: user.id, entityType: 'form', entityId: id, action: 'form_updated', message: `Form updated: ${data.name}` });
  return NextResponse.json({ form: data, message: c.saved });
}

export async function DELETE(request: Request, context: RouteContext) {
  const c = getFormApiCopy(localeFromRequest(request));
  const { id } = await context.params;
  const { supabase, user, org } = await contextForRequest();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  const { error } = await supabase.from('everitt_forms').delete().eq('id', id).eq('organization_id', org.organizationId);
  if (error) return NextResponse.json({ error: mapWorkspaceSaveError(error.message, c.saveForm) }, { status: 400 });
  await logActivityServer({ organizationId: org.organizationId, userId: user.id, entityType: 'form', entityId: id, action: 'form_deleted', message: 'Form deleted' });
  return NextResponse.json({ ok: true, message: c.removed });
}
