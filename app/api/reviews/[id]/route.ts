import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as { status?: string; rating?: number; review_body?: string };

  if (body.status === 'submitted' && body.rating) {
    const { data: reqRow } = await supabase
      .from('review_requests')
      .select('id')
      .eq('id', id)
      .eq('organization_id', org.organizationId)
      .maybeSingle();

    if (!reqRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await supabase.from('customer_reviews').insert({
      organization_id: org.organizationId,
      review_request_id: id,
      rating: body.rating,
      body: body.review_body?.trim() || null,
      status: 'submitted'
    });

    const { data, error } = await supabase
      .from('review_requests')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', org.organizationId)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logActivityServer({
      organizationId: org.organizationId,
      userId: user.id,
      entityType: 'review',
      entityId: id,
      action: 'review_submitted',
      message: `Customer review submitted (${body.rating}/5)`
    });

    return NextResponse.json({ request: data });
  }

  const { data, error } = await supabase
    .from('review_requests')
    .update({
      ...(body.status ? { status: body.status } : {}),
      ...(body.status === 'sent' ? { sent_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organization_id', org.organizationId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivityServer({
    organizationId: org.organizationId,
    userId: user.id,
    entityType: 'review_request',
    entityId: id,
    action: 'review_request_updated',
    message: `Review request updated: ${data.status}`
  });

  return NextResponse.json({ request: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { error } = await supabase
    .from('review_requests')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.organizationId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
