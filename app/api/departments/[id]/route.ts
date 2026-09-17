import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageDepartments } from '@/lib/departments';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { canAssignJobs, normalizeRole } from '@/lib/roles';
import { departmentBelongsToOrg, userBelongsToOrg } from '@/lib/org-validation';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getDepartmentsApiCopy } from '@/lib/i18n/departments-api-copy';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const c = getDepartmentsApiCopy(localeFromRequest(request));
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) return NextResponse.json({ error: c.organizationNotFound }, { status: 404 });
  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!canManageDepartments(normalizeRole(org.role), plan)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { name?: string; description?: string };
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  const { error } = await admin.from('departments').update({ ...(body.name !== undefined ? { name: body.name.trim() } : {}), ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}), updated_at: new Date().toISOString() }).eq('id', id).eq('organization_id', org.organizationId);
  if (error) return NextResponse.json({ error: c.saveError }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const c = getDepartmentsApiCopy(localeFromRequest(request));
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) return NextResponse.json({ error: c.organizationNotFound }, { status: 404 });
  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!canManageDepartments(normalizeRole(org.role), plan)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  const { error } = await admin.from('departments').delete().eq('id', id).eq('organization_id', org.organizationId);
  if (error) return NextResponse.json({ error: c.saveError }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: RouteParams) {
  const c = getDepartmentsApiCopy(localeFromRequest(request));
  const { id: departmentId } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });
  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canAssignJobs(normalizeRole(org.role))) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });
  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!canManageDepartments(normalizeRole(org.role), plan)) return NextResponse.json({ error: c.planRequired }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { userId?: string; action?: 'add' | 'remove' };
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  if (!(await departmentBelongsToOrg(admin, departmentId, org.organizationId))) return NextResponse.json({ error: c.departmentNotFound }, { status: 404 });
  if (body.action === 'remove' && body.userId) {
    const { error } = await admin.from('department_memberships').delete().eq('department_id', departmentId).eq('user_id', body.userId).eq('organization_id', org.organizationId);
    if (error) return NextResponse.json({ error: c.membershipSaveError }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (!body.userId) return NextResponse.json({ error: c.userIdRequired }, { status: 400 });
  if (!(await userBelongsToOrg(admin, body.userId, org.organizationId))) return NextResponse.json({ error: c.inactiveMember }, { status: 400 });
  const { error } = await admin.from('department_memberships').upsert({ department_id: departmentId, organization_id: org.organizationId, user_id: body.userId }, { onConflict: 'department_id,user_id' });
  if (error) return NextResponse.json({ error: c.membershipSaveError }, { status: 400 });
  return NextResponse.json({ ok: true });
}
