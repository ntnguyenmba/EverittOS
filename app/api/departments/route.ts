import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageDepartments } from '@/lib/departments';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getDepartmentsApiCopy } from '@/lib/i18n/departments-api-copy';

export async function GET(request: Request) {
  const c = getDepartmentsApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) return NextResponse.json({ error: c.organizationNotFound }, { status: 404 });

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });

  const { data, error } = await admin.from('departments').select('*, department_memberships(user_id)').eq('organization_id', org.organizationId).order('name');
  if (error) return NextResponse.json({ error: c.loadError }, { status: 500 });

  return NextResponse.json({ plan, canManage: canManageDepartments(normalizeRole(org.role), plan), departments: data || [] });
}

export async function POST(request: Request) {
  const c = getDepartmentsApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) return NextResponse.json({ error: c.organizationNotFound }, { status: 404 });

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!canManageDepartments(normalizeRole(org.role), plan)) return NextResponse.json({ error: c.planRequired }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { name?: string; description?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: c.nameRequired }, { status: 400 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });

  const { data, error } = await admin.from('departments').insert({ organization_id: org.organizationId, name: body.name.trim(), description: body.description?.trim() || null }).select('*').single();
  if (error) return NextResponse.json({ error: c.saveError }, { status: 400 });
  return NextResponse.json({ department: data });
}
