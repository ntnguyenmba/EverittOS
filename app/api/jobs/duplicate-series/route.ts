import { NextResponse } from 'next/server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JobRow = {
  id: string;
  title: string | null;
  customer_id: string | null;
  customer_name: string | null;
  address: string | null;
  status: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  start_date: string | null;
  due_date: string | null;
  revenue_amount: number | null;
  recurring_series_id: string | null;
  occurrence_date: string | null;
  occurrence_local_time: string | null;
  created_at: string | null;
};

const finished = new Set(['completed', 'done', 'complete', 'closed', 'cancelled', 'canceled']);
const norm = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const dateOf = (job: JobRow) => job.occurrence_date || job.start_date || job.due_date || job.scheduled_start?.slice(0, 10) || '';
const startOf = (job: JobRow) => job.occurrence_local_time || job.scheduled_start?.slice(11, 16) || '';
const endOf = (job: JobRow) => job.scheduled_end?.slice(11, 16) || '';

function fingerprint(job: JobRow) {
  return [
    job.customer_id ? `id:${job.customer_id}` : `name:${norm(job.customer_name)}`,
    norm(job.address),
    norm(job.title),
    dateOf(job),
    startOf(job),
    endOf(job),
    job.revenue_amount == null ? '' : Number(job.revenue_amount).toFixed(2)
  ].join('|');
}

export async function GET() {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });

  const { data, error } = await ctx.supabase
    .from('jobs')
    .select('id,title,customer_id,customer_name,address,status,scheduled_start,scheduled_end,start_date,due_date,revenue_amount,recurring_series_id,occurrence_date,occurrence_local_time,created_at')
    .eq('organization_id', ctx.workspace.organizationId)
    .not('recurring_series_id', 'is', null);

  if (error) return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const rows = ((data || []) as JobRow[]).filter((job) => dateOf(job) >= today && !finished.has(norm(job.status)));
  const groups = new Map<string, JobRow[]>();
  for (const job of rows) {
    const key = fingerprint(job);
    const group = groups.get(key) || [];
    group.push(job);
    groups.set(key, group);
  }

  const duplicateSeries = new Map<string, { jobId: string; date: string; title: string; address: string }>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || a.id.localeCompare(b.id));
    const keeperSeries = sorted[0].recurring_series_id;
    for (const extra of sorted.slice(1)) {
      if (!extra.recurring_series_id || extra.recurring_series_id === keeperSeries || duplicateSeries.has(extra.recurring_series_id)) continue;
      duplicateSeries.set(extra.recurring_series_id, {
        jobId: extra.id,
        date: dateOf(extra),
        title: extra.title || 'Untitled job',
        address: extra.address || ''
      });
    }
  }

  return NextResponse.json({
    duplicateSeriesCount: duplicateSeries.size,
    duplicateSeries: [...duplicateSeries.values()]
  });
}
