import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { limitsForPlan } from '@/lib/everittos-limits';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { isManagerRole } from '@/lib/roles';
import { workflowBelongsToOrg } from '@/lib/org-validation';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getWorkflowApiCopy } from '@/lib/i18n/workflow-api-copy';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const c = getWorkflowApiCopy(localeFromRequest(request));
  const { id: workflowId } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !isManagerRole(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).workflowCustomization) return NextResponse.json({ error: c.planRequired }, { status: 403 });

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    step_type?: string;
    required?: boolean;
    sort_order?: number;
    reorder?: { stepId: string; direction: 'up' | 'down' }[];
  };

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  if (!(await workflowBelongsToOrg(admin, workflowId, org.organizationId))) return NextResponse.json({ error: c.workflowNotFound }, { status: 404 });

  if (body.reorder?.length) {
    for (const item of body.reorder) {
      const { data: step } = await admin.from('workflow_steps').select('sort_order').eq('id', item.stepId).eq('workflow_id', workflowId).eq('organization_id', org.organizationId).maybeSingle();
      if (!step) return NextResponse.json({ error: c.stepNotFound }, { status: 404 });
      const delta = item.direction === 'up' ? -1 : 1;
      const { error } = await admin.from('workflow_steps').update({ sort_order: (step.sort_order as number) + delta }).eq('id', item.stepId).eq('workflow_id', workflowId).eq('organization_id', org.organizationId);
      if (error) return NextResponse.json({ error: c.stepSaveError }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.title?.trim()) return NextResponse.json({ error: c.stepTitleRequired }, { status: 400 });

  const { count } = await admin.from('workflow_steps').select('id', { count: 'exact', head: true }).eq('workflow_id', workflowId).eq('organization_id', org.organizationId);
  const { data, error } = await admin.from('workflow_steps').insert({ workflow_id: workflowId, organization_id: org.organizationId, title: body.title.trim(), description: body.description?.trim() || null, step_type: body.step_type || 'checklist', required: body.required ?? true, sort_order: body.sort_order ?? (count || 0) }).select('*').single();
  if (error) return NextResponse.json({ error: c.stepSaveError }, { status: 400 });
  return NextResponse.json({ step: data });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const c = getWorkflowApiCopy(localeFromRequest(request));
  const { id: workflowId } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !isManagerRole(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).workflowCustomization) return NextResponse.json({ error: c.planRequired }, { status: 403 });

  const stepId = new URL(request.url).searchParams.get('stepId');
  if (!stepId) return NextResponse.json({ error: c.stepIdRequired }, { status: 400 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });
  if (!(await workflowBelongsToOrg(admin, workflowId, org.organizationId))) return NextResponse.json({ error: c.workflowNotFound }, { status: 404 });

  const { error } = await admin.from('workflow_steps').delete().eq('id', stepId).eq('workflow_id', workflowId).eq('organization_id', org.organizationId);
  if (error) return NextResponse.json({ error: c.stepSaveError }, { status: 400 });
  return NextResponse.json({ ok: true });
}
