import { NextResponse } from 'next/server';
import { loadContractorPortalJob } from '@/lib/portal-contractor-jobs';
import { sendOutboundDocument } from '@/lib/outbound/send-document';
import type { OutboundDocument } from '@/lib/outbound/types';
import { createServerSupabase } from '@/lib/supabase-server';
import { fetchOrganizationContextWithRepair } from '@/lib/workspace-server';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await context.params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const loaded = await loadContractorPortalJob({ supabase, userId: user.id, email: user.email, jobId });
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  const body = (await request.json().catch(() => ({}))) as { to?: string; message?: string; subject?: string };
  const to = body.to === 'owner' ? 'owner' : body.to === 'customer' ? 'customer' : '';
  const message = String(body.message || '').trim();
  const subject = String(body.subject || '').trim() || (to === 'owner' ? `Update on ${loaded.job.title}` : `Update about your job`);
  if (!to) return NextResponse.json({ error: 'Choose customer or owner.' }, { status: 400 });
  if (message.length < 2) return NextResponse.json({ error: 'Write a short message first.' }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: 'Keep the message under 2000 characters.' }, { status: 400 });

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { data: jobRow, error: jobError } = await supabase
    .from('jobs')
    .select('id, organization_id, customer_id, customer_email, customer_name, title, user_id')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 400 });
  if (!jobRow || jobRow.organization_id !== org.organizationId) {
    return NextResponse.json({ error: 'You do not have access to this job.' }, { status: 403 });
  }

  let customerEmail = String(jobRow.customer_email || '').trim();
  if (!customerEmail && jobRow.customer_id) {
    const { data: customer } = await supabase.from('customers').select('email').eq('id', jobRow.customer_id).maybeSingle();
    customerEmail = String(customer?.email || '').trim();
  }

  let ownerEmail = '';
  const { data: ownerMember } = await supabase
    .from('organization_members')
    .select('user_id, role, email')
    .eq('organization_id', org.organizationId)
    .in('role', ['owner', 'admin'])
    .order('role', { ascending: true })
    .limit(8);
  for (const row of ownerMember || []) {
    const email = String(row.email || '').trim();
    if (validEmail(email)) { ownerEmail = email; break; }
    if (row.user_id) {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', row.user_id).maybeSingle();
      const profileEmail = String(profile?.email || '').trim();
      if (validEmail(profileEmail)) { ownerEmail = profileEmail; break; }
    }
  }

  const recipientEmail = to === 'customer' ? customerEmail : ownerEmail;
  if (!validEmail(recipientEmail)) {
    return NextResponse.json({
      error: to === 'customer'
        ? 'This job has no customer email on file. Ask the owner to add one.'
        : 'No owner email is on file for this workspace.'
    }, { status: 400 });
  }

  const signed = `From the assigned worker on ${loaded.job.title}:\n\n${message}`;
  const { data: document, error } = await supabase.from('outbound_documents').insert({
    organization_id: org.organizationId,
    doc_type: 'message',
    status: 'draft',
    recipient_email: recipientEmail,
    recipient_name: to === 'customer' ? jobRow.customer_name || null : 'Owner',
    subject,
    body: signed,
    customer_id: jobRow.customer_id || null,
    job_id: jobId,
    metadata: { source: 'worker_send_word', audience: to, worker_user_id: user.id },
    created_by: user.id
  }).select('*').single();

  if (error || !document) {
    if (isMissingSchemaError(error)) return NextResponse.json({ error: 'Messaging is not set up yet.' }, { status: 503 });
    return NextResponse.json({ error: error?.message || 'Unable to create message.' }, { status: 400 });
  }

  try {
    const result = await sendOutboundDocument({
      supabase,
      organizationId: org.organizationId,
      userId: user.id,
      document: document as OutboundDocument
    });
    return NextResponse.json({
      ok: result.emailSent,
      emailSent: result.emailSent,
      message: result.emailSent
        ? (to === 'customer' ? 'Message emailed to the customer.' : 'Message emailed to the owner.')
        : (result.deliveryNote || 'Email could not be sent.')
    }, { status: result.emailSent ? 200 : 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unable to send.' }, { status: 400 });
  }
}
