import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { fetchOrganizationContextWithRepair, mapWorkspaceSaveError } from '@/lib/workspace-server';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

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

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, org } = await contextForRequest();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  const { data: form, error } = await supabase.from('everitt_forms').select('*, everitt_form_fields(*)').eq('id', id).eq('organization_id', org.organizationId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ form });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, org } = await contextForRequest();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

  const body = (await request.json()) as { name?: string; active?: boolean; description?: string; settings?: Record<string, unknown> };
  const { data, error } = await supabase.from('everitt_forms').update({
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.active !== undefined ? { active: body.active } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.settings !== undefined ? { settings: body.settings } : {}),
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('organization_id', org.organizationId).select('*').single();

  if (error) return NextResponse.json({ error: mapWorkspaceSaveError(error.message, 'Unable to save form. Please try again.') }, { status: 400 });
  await logActivityServer({ organizationId: org.organizationId, userId: user.id, entityType: 'form', entityId: id, action: 'form_updated', message: `Form updated: ${data.name}` });
  return NextResponse.json({ form: data, message: 'Form saved successfully.' });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, org } = await contextForRequest();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  const { error } = await supabase.from('everitt_forms').delete().eq('id', id).eq('organization_id', org.organizationId);
  if (error) return NextResponse.json({ error: mapWorkspaceSaveError(error.message, 'Unable to save form. Please try again.') }, { status: 400 });
  await logActivityServer({ organizationId: org.organizationId, userId: user.id, entityType: 'form', entityId: id, action: 'form_deleted', message: 'Form deleted' });
  return NextResponse.json({ ok: true, message: 'Form removed successfully.' });
}
