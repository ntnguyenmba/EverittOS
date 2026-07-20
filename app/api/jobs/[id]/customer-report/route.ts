import { NextResponse } from 'next/server';
import { ensureJobReportShare, revokeJobReportShare } from '@/lib/customer-report';
import { requireFinanceApiAccess } from '@/lib/finance-api-auth';
import { normalizeLocale, type Locale } from '@/lib/i18n/config';
import { isValidUuid } from '@/lib/input-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

async function resolveJob(ctx: Awaited<ReturnType<typeof requireFinanceApiAccess>>, jobId: string) {
  if (!ctx.ok) return null;
  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('id, title')
    .eq('id', jobId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  return job;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { id: jobId } = await params;
  if (!isValidUuid(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  const job = await resolveJob(ctx, jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { data: report } = await ctx.supabase
    .from('job_reports')
    .select('id, share_token, share_revoked_at, customer_completion_notes, report_locale')
    .eq('organization_id', ctx.organizationId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const shareToken = report?.share_token ? String(report.share_token) : null;
  const revoked = Boolean(report?.share_revoked_at);

  return NextResponse.json({
    reportId: report?.id || null,
    shareToken: revoked ? null : shareToken,
    shareUrl: shareToken && !revoked ? `/report/${shareToken}` : null,
    revoked,
    customerCompletionNotes: report?.customer_completion_notes || null,
    reportLocale: report?.report_locale || null
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const ctx = await requireFinanceApiAccess();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  if (!ctx.canManage) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id: jobId } = await params;
  if (!isValidUuid(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  const job = await resolveJob(ctx, jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: 'share' | 'revoke' | 'regenerate';
    locale?: string | null;
    customer_completion_notes?: string | null;
  };

  if (body.customer_completion_notes !== undefined) {
    const { data: existing } = await ctx.supabase
      .from('job_reports')
      .select('id')
      .eq('organization_id', ctx.organizationId)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await ctx.supabase
        .from('job_reports')
        .update({ customer_completion_notes: body.customer_completion_notes?.trim() || null })
        .eq('id', existing.id);
    }
  }

  if (body.action === 'revoke') {
    const result = await revokeJobReportShare(ctx.supabase, ctx.organizationId, jobId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Unable to revoke link.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, revoked: true });
  }

  const locale = normalizeLocale(body.locale) as Locale;
  const { share, error } = await ensureJobReportShare(ctx.supabase, {
    organizationId: ctx.organizationId,
    jobId,
    userId: ctx.userId,
    title: `${job.title} report`,
    locale,
    regenerate: body.action === 'regenerate'
  });

  if (error || !share) {
    return NextResponse.json({ error: error || 'Unable to create share link.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, share });
}
