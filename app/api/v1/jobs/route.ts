import { NextResponse } from 'next/server';
import { authenticateApiRequest, hasScope, jsonError } from '@/lib/api-auth';
import { ALLOWED_JOB_STATUSES, customerBelongsToOrg } from '@/lib/org-validation';
import { enforcePlanForUser } from '@/lib/plan-enforce-server';

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  if (!hasScope(auth, 'read:jobs')) return jsonError('Missing read:jobs scope.', 403);

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);

  let query = auth.admin
    .from('jobs')
    .select('id, title, status, customer_name, customer_id, assigned_to, scheduled_start, scheduled_end, start_date, due_date, department_id, created_at')
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    if (!ALLOWED_JOB_STATUSES.has(status)) {
      return jsonError('Invalid status filter.', 400);
    }
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ jobs: data || [] });
}

export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (auth instanceof NextResponse) return auth;
  if (!hasScope(auth, 'write:jobs')) return jsonError('Missing write:jobs scope.', 403);

  const body = (await request.json()) as {
    title?: string;
    customer_name?: string;
    customer_id?: string;
    status?: string;
    notes?: string;
    scheduled_start?: string;
    scheduled_end?: string;
  };

  if (!body.title?.trim()) return jsonError('title is required.', 400);

  if (body.status && !ALLOWED_JOB_STATUSES.has(body.status)) {
    return jsonError('Invalid job status.', 400);
  }

  if (body.customer_id) {
    const validCustomer = await customerBelongsToOrg(auth.admin, body.customer_id, auth.organizationId);
    if (!validCustomer) {
      return jsonError('Customer not found in organization.', 400);
    }
  }

  const { data: org } = await auth.admin.from('organizations').select('owner_user_id').eq('id', auth.organizationId).maybeSingle();
  if (!org?.owner_user_id) return jsonError('Organization not found.', 404);

  const enforce = await enforcePlanForUser(auth.admin, org.owner_user_id, 'jobs');
  if (!enforce.allowed) return jsonError(enforce.message || 'Plan limit reached.', 403);

  const { data, error } = await auth.admin
    .from('jobs')
    .insert({
      user_id: org.owner_user_id,
      organization_id: auth.organizationId,
      title: body.title.trim(),
      customer_name: body.customer_name?.trim() || null,
      customer_id: body.customer_id || null,
      status: body.status || 'new',
      notes: body.notes?.trim() || null,
      scheduled_start: body.scheduled_start || null,
      scheduled_end: body.scheduled_end || null,
      start_date: body.scheduled_start ? body.scheduled_start.slice(0, 10) : null,
      due_date: body.scheduled_end ? body.scheduled_end.slice(0, 10) : body.scheduled_start?.slice(0, 10) || null
    })
    .select('id, title, status, created_at')
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ job: data }, { status: 201 });
}
