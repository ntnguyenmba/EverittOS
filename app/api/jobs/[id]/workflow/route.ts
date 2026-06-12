import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { limitsForPlan } from '@/lib/everittos-limits';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { isManagerRole, isStaffRole, normalizeRole } from '@/lib/roles';
import { workflowBelongsToOrg, workflowStepBelongsToOrg } from '@/lib/org-validation';
import { createServerSupabase } from '@/lib/supabase-server';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: jobId } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });

  const { data: job } = await admin.from('jobs').select('workflow_template_id, organization_id').eq('id', jobId).maybeSingle();
  if (!job || job.organization_id !== org.organizationId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (!job.workflow_template_id) {
    return NextResponse.json({ workflow: null, steps: [], progress: [] });
  }

  const [{ data: steps }, { data: progress }] = await Promise.all([
    admin
      .from('workflow_steps')
      .select('*')
      .eq('workflow_id', job.workflow_template_id)
      .order('sort_order'),
    admin.from('job_workflow_progress').select('*').eq('job_id', jobId)
  ]);

  return NextResponse.json({ steps: steps || [], progress: progress || [] });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: jobId } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  const role = normalizeRole(org?.role);
  if (!org || !(isManagerRole(role) || isStaffRole(role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).workflowCustomization) {
    return NextResponse.json({ error: 'Workflows require Operations or higher.' }, { status: 403 });
  }

  const body = (await request.json()) as {
    workflowTemplateId?: string | null;
    stepId?: string;
    completed?: boolean;
    note?: string;
  };

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });

  const { data: job } = await admin
    .from('jobs')
    .select('organization_id, workflow_template_id')
    .eq('id', jobId)
    .maybeSingle();
  if (!job || job.organization_id !== org.organizationId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (body.workflowTemplateId !== undefined && isManagerRole(role)) {
    if (body.workflowTemplateId) {
      const validTemplate = await workflowBelongsToOrg(admin, body.workflowTemplateId, org.organizationId);
      if (!validTemplate) {
        return NextResponse.json({ error: 'Workflow template not found' }, { status: 404 });
      }
    }
    await admin.from('jobs').update({ workflow_template_id: body.workflowTemplateId }).eq('id', jobId);
    if (body.workflowTemplateId) {
      const { data: steps } = await admin
        .from('workflow_steps')
        .select('id')
        .eq('workflow_id', body.workflowTemplateId);
      for (const step of steps || []) {
        await admin.from('job_workflow_progress').upsert(
          {
            job_id: jobId,
            workflow_step_id: step.id,
            organization_id: org.organizationId,
            completed: false
          },
          { onConflict: 'job_id,workflow_step_id' }
        );
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.stepId) return NextResponse.json({ error: 'stepId is required' }, { status: 400 });

  const workflowId = job.workflow_template_id;
  if (!workflowId) {
    return NextResponse.json({ error: 'Job has no workflow template' }, { status: 400 });
  }

  const stepInWorkflow = await workflowStepBelongsToOrg(admin, body.stepId, workflowId, org.organizationId);
  if (!stepInWorkflow) {
    return NextResponse.json({ error: 'Step not found' }, { status: 404 });
  }

  const { data: step } = await admin
    .from('workflow_steps')
    .select('step_type, required')
    .eq('id', body.stepId)
    .eq('workflow_id', workflowId)
    .eq('organization_id', org.organizationId)
    .maybeSingle();
  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 });

  if (step.step_type === 'note' && body.completed && !body.note?.trim()) {
    return NextResponse.json({ error: 'This step requires a note.' }, { status: 400 });
  }

  const { error } = await admin.from('job_workflow_progress').upsert(
    {
      job_id: jobId,
      workflow_step_id: body.stepId,
      organization_id: org.organizationId,
      completed: body.completed ?? true,
      completed_at: body.completed !== false ? new Date().toISOString() : null,
      completed_by: body.completed !== false ? user.id : null,
      note: body.note?.trim() || null
    },
    { onConflict: 'job_id,workflow_step_id' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
