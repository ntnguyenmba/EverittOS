import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { buildCustomerWritePayload } from '@/lib/customer-record';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createServerSupabase();

  const { data: form } = await supabase
    .from('everitt_forms')
    .select('id, organization_id, name, active')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  const payload = (await request.json()) as Record<string, string>;
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const name = payload.Name || payload.name || payload.full_name || 'New lead';
  const email = payload.Email || payload.email || null;
  const phone = payload.Phone || payload.phone || null;

  const { data: customer, error: customerError } = await admin
    .from('customers')
    .insert({
      organization_id: form.organization_id,
      ...buildCustomerWritePayload({
        displayName: String(name).trim(),
        email: email ? String(email).trim() : null,
        phone: phone ? String(phone).trim() : null,
        notes: payload.Message || payload.message || null,
        record_type: 'lead',
        pipeline_stage: 'lead',
        lead_source: 'form'
      })
    })
    .select('id')
    .single();

  if (customerError) {
    return NextResponse.json({ error: customerError.message }, { status: 400 });
  }

  await admin.from('everitt_form_submissions').insert({
    form_id: form.id,
    organization_id: form.organization_id,
    payload,
    source: 'public',
    customer_id: customer?.id || null
  });

  const { data: org } = await admin.from('organizations').select('owner_user_id').eq('id', form.organization_id).maybeSingle();

  if (org?.owner_user_id) {
    await admin.from('notifications').insert({
      organization_id: form.organization_id,
      user_id: org.owner_user_id,
      type: 'organization',
      title: 'New form submission',
      body: `${form.name}: ${name}`
    });
  }

  await logActivityServer({
    organizationId: form.organization_id,
    entityType: 'lead',
    entityId: customer?.id || null,
    action: 'lead_created',
    message: `Lead from form ${form.name}: ${name}`
  });

  return NextResponse.json({ ok: true, message: 'Thank you. We received your submission.' });
}
