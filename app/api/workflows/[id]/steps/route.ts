import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { limitsForPlan } from '@/lib/everittos-limits';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { isManagerRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id: workflowId } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !isManagerRole(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).workflowCustomization) {
    return NextResponse.json({ error: 'Custom workflows require Growth or Enterprise.' }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    step_type?: string;
    required?: boolean;
    sort_order?: number;
    reorder?: { stepId: string; direction: 'up' | 'down' }[];
  };

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });

  if (body.reorder?.length) {
    for (const item of body.reorder) {
      const { data: step } = await admin
        .from('workflow_steps')
        .select('sort_order')
        .eq('id', item.stepId)
        .eq('workflow_id', workflowId)
        .maybeSingle();
      if (!step) continue;
      const delta = item.direction === 'up' ? -1 : 1;
      await admin
        .from('workflow_steps')
        .update({ sort_order: (step.sort_order as number) + delta })
        .eq('id', item.stepId);
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const { count } = await admin
    .from('workflow_steps')
    .select('id', { count: 'exact', head: true })
    .eq('workflow_id', workflowId);

  const { data, error } = await admin
    .from('workflow_steps')
    .insert({
      workflow_id: workflowId,
      organization_id: org.organizationId,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      step_type: body.step_type || 'checklist',
      required: body.required ?? true,
      sort_order: body.sort_order ?? (count || 0)
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ step: data });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id: workflowId } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !isManagerRole(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const url = new URL(request.url);
  const stepId = url.searchParams.get('stepId');
  if (!stepId) return NextResponse.json({ error: 'stepId is required' }, { status: 400 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });

  const { error } = await admin
    .from('workflow_steps')
    .delete()
    .eq('id', stepId)
    .eq('workflow_id', workflowId)
    .eq('organization_id', org.organizationId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
