import { NextResponse } from 'next/server';
import { loadClientPortalJob } from '@/lib/portal-client-jobs';
import { sendOutboundDocument } from '@/lib/outbound/send-document';
import type { OutboundDocument } from '@/lib/outbound/types';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await context.params;
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const loaded = await loadClientPortalJob({ admin, userId: user.id, email: user.email, jobId });
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const message = String(body.message || '').trim();
  if (message.length < 2) return NextResponse.json({ error: 'Write a short message first.' }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: 'Keep the message under 2000 characters.' }, { status: 400 });

  const { data: jobRow, error: jobError } = await admin
    .from('jobs')
    .select('id, organization_id, customer_id, customer_name, title')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError || !jobRow) return NextResponse.json({ error: jobError?.message || 'Job not found.' }, { status: 404 });

  let ownerEmail = '';
  const { data: owners } = await admin
    .from('organization_members')
    .select('user_id, role, email')
    .eq('organization_id', jobRow.organization_id)
    .in('role', ['owner', 'admin'])
    .order('role', { ascending: true })
    .limit(8);

  for (const row of owners || []) {
    const email = String(row.email || '').trim();
    if (validEmail(email)) { ownerEmail = email; break; }
    if (row.user_id) {
      const { data: profile } = await admin.from('profiles').select('email').eq('id', row.user_id).maybeSingle();
      const profileEmail = String(profile?.email || '').trim();
      if (validEmail(profileEmail)) { ownerEmail = profileEmail; break; }
    }
  }

  if (!validEmail(ownerEmail)) return NextResponse.json({ error: 'No company email is on file.' }, { status: 400 });

  const clientName = String(jobRow.customer_name || user.email || 'Client');
  const signed = `From ${clientName} about ${jobRow.title}:\n\n${message}`;
  const { data: document, error } = await admin.from('outbound_documents').insert({
    organization_id: jobRow.organization_id,
    doc_type: 'message',
    status: 'draft',
    recipient_email: ownerEmail,
    recipient_name: 'Owner',
    subject: `Client message about ${jobRow.title}`,
    body: signed,
    customer_id: jobRow.customer_id || null,
    job_id: jobId,
    metadata: { source: 'client_portal_message', audience: 'owner', client_user_id: user.id },
    created_by: user.id
  }).select('*').single();

  if (error || !document) return NextResponse.json({ error: error?.message || 'Unable to create message.' }, { status: 400 });

  try {
    const result = await sendOutboundDocument({
      supabase: admin,
      organizationId: jobRow.organization_id,
      userId: user.id,
      document: document as OutboundDocument
    });
    return NextResponse.json({
      ok: result.emailSent,
      emailSent: result.emailSent,
      message: result.emailSent ? 'Message sent.' : (result.deliveryNote || 'Message could not be sent.')
    }, { status: result.emailSent ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send.' }, { status: 400 });
  }
}
