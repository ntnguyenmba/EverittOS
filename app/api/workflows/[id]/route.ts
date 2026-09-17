import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { limitsForPlan } from '@/lib/everittos-limits';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { isManagerRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getWorkflowApiCopy } from '@/lib/i18n/workflow-api-copy';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const c = getWorkflowApiCopy(localeFromRequest(request));
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !isManagerRole(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).workflowCustomization) return NextResponse.json({ error: c.planRequired }, { status: 403 });

  const body = (await request.json()) as { name?: string; description?: string; active?: boolean };
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });

  const { error } = await admin.from('workflow_templates').update({
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
    ...(body.active !== undefined ? { active: body.active } : {}),
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('organization_id', org.organizationId);

  if (error) return NextResponse.json({ error: c.saveError }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const c = getWorkflowApiCopy(localeFromRequest(request));
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !isManagerRole(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).workflowCustomization) return NextResponse.json({ error: c.planRequired }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });

  const { error } = await admin.from('workflow_templates').delete().eq('id', id).eq('organization_id', org.organizationId);
  if (error) return NextResponse.json({ error: c.saveError }, { status: 400 });
  return NextResponse.json({ ok: true });
}
