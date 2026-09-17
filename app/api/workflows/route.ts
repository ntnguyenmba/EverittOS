import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { limitsForPlan } from '@/lib/everittos-limits';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { isManagerRole } from '@/lib/roles';
import { canSeeOrgWideData } from '@/lib/permissions';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getWorkflowApiCopy } from '@/lib/i18n/workflow-api-copy';

export async function GET(request: Request) {
  const c = getWorkflowApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) return NextResponse.json({ error: c.organizationNotFound }, { status: 404 });
  if (!canSeeOrgWideData(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).workflowCustomization) return NextResponse.json({ plan, canManage: false, workflows: [] });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });

  const { data: workflows, error } = await admin.from('workflow_templates').select('*, workflow_steps(*)').eq('organization_id', org.organizationId).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: c.loadError }, { status: 500 });

  return NextResponse.json({ plan, canManage: limitsForPlan(plan).workflowCustomization && isManagerRole(org.role), workflows: workflows || [] });
}

export async function POST(request: Request) {
  const c = getWorkflowApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !isManagerRole(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).workflowCustomization) return NextResponse.json({ error: c.planRequired }, { status: 403 });

  const body = (await request.json()) as { name?: string; description?: string; steps?: { title: string; description?: string; step_type?: string; required?: boolean }[] };
  if (!body.name?.trim()) return NextResponse.json({ error: c.nameRequired }, { status: 400 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });

  const { data: workflow, error } = await admin.from('workflow_templates').insert({ organization_id: org.organizationId, name: body.name.trim(), description: body.description?.trim() || null, created_by: user.id, active: true }).select('*').single();
  if (error || !workflow) return NextResponse.json({ error: c.saveError }, { status: 400 });

  const steps = body.steps || [];
  if (steps.length) {
    await admin.from('workflow_steps').insert(steps.map((step, index) => ({ workflow_id: workflow.id, organization_id: org.organizationId, title: step.title.trim(), description: step.description?.trim() || null, sort_order: index, required: step.required ?? true, step_type: step.step_type || 'checklist' })));
  }

  return NextResponse.json({ workflow });
}
