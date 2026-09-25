import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { fetchOrganizationContextWithRepair } from '@/lib/workspace-server';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('template_library')
    .select('*')
    .eq('id', id)
    .eq('organization_id', org.organizationId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as { title?: string; body?: string; category?: string };

  const { data: existing } = await supabase
    .from('template_library')
    .select('id, title, body, category, version')
    .eq('id', id)
    .eq('organization_id', org.organizationId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('template_library')
    .update({
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.body !== undefined ? { body: body.body } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      version: (existing.version || 1) + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organization_id', org.organizationId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });

  await logActivityServer({
    organizationId: org.organizationId,
    userId: user.id,
    entityType: 'template',
    entityId: id,
    action: 'template_updated',
    message: `Template updated: ${data.title}`
  });

  return NextResponse.json({ template: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { error } = await supabase.from('template_library').delete().eq('id', id).eq('organization_id', org.organizationId);
  if (error) return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });

  await logActivityServer({
    organizationId: org.organizationId,
    userId: user.id,
    entityType: 'template',
    entityId: id,
    action: 'template_deleted',
    message: 'Template deleted'
  });

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { data: source, error: fetchError } = await supabase
    .from('template_library')
    .select('*')
    .eq('id', id)
    .eq('organization_id', org.organizationId)
    .maybeSingle();

  if (fetchError || !source) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('template_library')
    .insert({
      organization_id: org.organizationId,
      category: source.category,
      title: `${source.title} (copy)`,
      body: source.body,
      parent_id: source.id,
      version: 1,
      created_by: user.id
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });

  await logActivityServer({
    organizationId: org.organizationId,
    userId: user.id,
    entityType: 'template',
    entityId: data.id,
    action: 'template_duplicated',
    message: `Template duplicated from ${source.title}`
  });

  return NextResponse.json({ template: data });
}
