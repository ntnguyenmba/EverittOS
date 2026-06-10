import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageDepartments } from '@/lib/departments';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });

  const { data, error } = await admin
    .from('departments')
    .select('*, department_memberships(user_id)')
    .eq('organization_id', org.organizationId)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    plan,
    canManage: canManageDepartments(normalizeRole(org.role), plan),
    departments: data || []
  });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!canManageDepartments(normalizeRole(org.role), plan)) {
    return NextResponse.json({ error: 'Departments require Growth or Enterprise.' }, { status: 403 });
  }

  const body = (await request.json()) as { name?: string; description?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });

  const { data, error } = await admin
    .from('departments')
    .insert({
      organization_id: org.organizationId,
      name: body.name.trim(),
      description: body.description?.trim() || null
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ department: data });
}
