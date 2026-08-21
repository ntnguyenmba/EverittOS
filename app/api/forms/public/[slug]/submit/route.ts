import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { buildCustomerWritePayload } from '@/lib/customer-record';
import { calculateEstimate, formatEstimateRange } from '@/lib/estimate-engine';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

function value(payload: Record<string, string>, keys: string[]) {
  for (const key of keys) if (payload[key]?.trim()) return payload[key].trim();
  return null;
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createServerSupabase();
  const { data: form } = await supabase.from('everitt_forms').select('id, organization_id, name, form_type, settings, active').eq('slug', slug).eq('active', true).maybeSingle();
  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

  const payload = (await request.json()) as Record<string, string>;
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });

  const name = value(payload, ['Name', 'name', 'full_name']) || 'New lead';
  const email = value(payload, ['Email', 'email']);
  const phone = value(payload, ['Phone', 'phone']);
  const address = value(payload, ['Service address', 'Address', 'address']);
  const estimate = form.form_type === 'estimate' ? calculateEstimate(form.settings, payload) : null;
  const estimateRange = estimate ? formatEstimateRange(estimate) : null;

  if (estimate) {
    payload['Estimated range'] = estimateRange || '';
    payload['Estimate midpoint'] = String(estimate.midpoint);
    payload['Estimate currency'] = estimate.currency;
  }

  const detailLines = [
    form.form_type === 'estimate' ? 'Estimate request' : null,
    value(payload, ['Service type']) ? `Service: ${value(payload, ['Service type'])}` : null,
    value(payload, ['Bedrooms']) ? `Bedrooms: ${value(payload, ['Bedrooms'])}` : null,
    value(payload, ['Bathrooms']) ? `Bathrooms: ${value(payload, ['Bathrooms'])}` : null,
    value(payload, ['Approx. sq ft']) ? `Approx. sq ft: ${value(payload, ['Approx. sq ft'])}` : null,
    value(payload, ['Frequency']) ? `Frequency: ${value(payload, ['Frequency'])}` : null,
    value(payload, ['Add-ons']) ? `Add-ons: ${value(payload, ['Add-ons'])}` : null,
    estimateRange ? `Estimated range: ${estimateRange}` : null,
    estimate ? `Estimate midpoint: ${estimate.midpoint}` : null,
    estimate ? `Estimate currency: ${estimate.currency}` : null,
    value(payload, ['Notes', 'Message', 'message'])
  ].filter(Boolean).join('\n');

  const { data: customer, error: customerError } = await admin.from('customers').insert({
    organization_id: form.organization_id,
    ...buildCustomerWritePayload({
      displayName: name,
      email,
      phone,
      address,
      notes: detailLines || null,
      record_type: 'lead',
      pipeline_stage: 'open',
      lead_source: 'form'
    })
  }).select('id').single();

  if (customerError) return NextResponse.json({ error: customerError.message }, { status: 400 });

  await admin.from('everitt_form_submissions').insert({ form_id: form.id, organization_id: form.organization_id, payload, source: form.form_type === 'estimate' ? 'estimate' : 'public', customer_id: customer?.id || null });

  const { data: org } = await admin.from('organizations').select('owner_user_id').eq('id', form.organization_id).maybeSingle();
  if (org?.owner_user_id) {
    await admin.from('notifications').insert({
      organization_id: form.organization_id,
      user_id: org.owner_user_id,
      type: 'organization',
      title: form.form_type === 'estimate' ? 'New estimate request' : 'New form submission',
      body: `${name}${estimateRange ? ` · ${estimateRange}` : ''}${value(payload, ['Frequency']) ? ` · ${value(payload, ['Frequency'])}` : ''}`
    });
  }

  await logActivityServer({ organizationId: form.organization_id, entityType: 'lead', entityId: customer?.id || null, action: 'lead_created', message: `${form.form_type === 'estimate' ? 'Estimate request' : 'Lead'} from ${form.name}: ${name}` });

  return NextResponse.json({ ok: true, customerId: customer?.id || null, estimate, message: 'Thank you. We received your request.' });
}
