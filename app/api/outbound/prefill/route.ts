import { NextResponse } from 'next/server';
import { requireOutboundApiAccess } from '@/lib/outbound/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ctx = await requireOutboundApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId')?.trim() || '';
  const customerId = url.searchParams.get('customerId')?.trim() || '';

  let job: {
    id: string;
    title: string | null;
    customer_id: string | null;
    customer_name: string | null;
    customer_email: string | null;
    revenue_amount: number | null;
  } | null = null;

  if (jobId) {
    const { data, error } = await ctx.supabase
      .from('jobs')
      .select('id, title, customer_id, customer_name, customer_email, revenue_amount')
      .eq('id', jobId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }
    job = data;
  }

  const resolvedCustomerId = customerId || job?.customer_id || '';
  let customer: { id: string; name: string | null; email: string | null } | null = null;

  if (resolvedCustomerId) {
    const { data, error } = await ctx.supabase
      .from('customers')
      .select('id, name, email')
      .eq('id', resolvedCustomerId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    customer = data;
  }

  return NextResponse.json({
    prefill: {
      job_id: job?.id || jobId || null,
      customer_id: customer?.id || resolvedCustomerId || null,
      recipient_name: customer?.name || job?.customer_name || '',
      recipient_email: customer?.email || job?.customer_email || '',
      amount: job?.revenue_amount ?? null,
      job_title: job?.title || ''
    }
  });
}
