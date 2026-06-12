import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { fetchOrganizationContextWithRepair } from '@/lib/workspace-server';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const [requestsRes, reviewsRes] = await Promise.all([
    supabase
      .from('review_requests')
      .select('id, job_id, customer_id, customer_email, status, sent_at, submitted_at, created_at')
      .eq('organization_id', org.organizationId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('customer_reviews')
      .select('id, review_request_id, rating, body, status, created_at')
      .eq('organization_id', org.organizationId)
      .order('created_at', { ascending: false })
      .limit(100)
  ]);

  if (requestsRes.error) return NextResponse.json({ error: requestsRes.error.message }, { status: 500 });

  return NextResponse.json({
    requests: requestsRes.data || [],
    reviews: reviewsRes.data || []
  });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as {
    job_id?: string;
    customer_id?: string;
    customer_email?: string;
    message?: string;
    send?: boolean;
  };

  const status = body.send ? 'sent' : 'pending';

  const { data, error } = await supabase
    .from('review_requests')
    .insert({
      organization_id: org.organizationId,
      job_id: body.job_id || null,
      customer_id: body.customer_id || null,
      customer_email: body.customer_email?.trim() || null,
      message: body.message?.trim() || null,
      status,
      sent_at: body.send ? new Date().toISOString() : null,
      created_by: user.id
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivityServer({
    organizationId: org.organizationId,
    userId: user.id,
    entityType: 'review_request',
    entityId: data.id,
    action: 'review_request_created',
    message: `Review request ${status === 'sent' ? 'sent' : 'created'}`
  });

  return NextResponse.json({ request: data });
}
