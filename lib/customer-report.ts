import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '@/lib/i18n/config';
import { attachSignedUrls } from '@/lib/job-photos-client';
import type { JobPhotoRecord } from '@/lib/job-photos-types';

export type CustomerReportShare = {
  reportId: string;
  jobId: string;
  shareToken: string;
  shareUrl: string;
  revoked: boolean;
};

export function generateShareToken(): string {
  return randomBytes(24).toString('hex');
}

export async function ensureJobReportShare(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    jobId: string;
    userId: string;
    title?: string;
    locale?: Locale | string | null;
    regenerate?: boolean;
  }
): Promise<{ share: CustomerReportShare | null; error: string | null }> {
  const { data: existing } = await supabase
    .from('job_reports')
    .select('id, job_id, share_token, share_revoked_at, title')
    .eq('organization_id', input.organizationId)
    .eq('job_id', input.jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let reportId = existing?.id ? String(existing.id) : '';
  let token = existing?.share_token ? String(existing.share_token) : '';

  if (!reportId || input.regenerate || !token || existing?.share_revoked_at) {
    token = generateShareToken();
    if (reportId) {
      const { error } = await supabase
        .from('job_reports')
        .update({
          share_token: token,
          share_created_at: new Date().toISOString(),
          share_revoked_at: null,
          report_locale: input.locale || null
        })
        .eq('id', reportId)
        .eq('organization_id', input.organizationId);
      if (error) return { share: null, error: error.message };
    } else {
      const { data: created, error } = await supabase
        .from('job_reports')
        .insert({
          organization_id: input.organizationId,
          job_id: input.jobId,
          user_id: input.userId,
          title: input.title || 'Customer service report',
          share_token: token,
          share_created_at: new Date().toISOString(),
          report_locale: input.locale || null
        })
        .select('id, job_id, share_token, share_revoked_at')
        .single();
      if (error || !created) return { share: null, error: error?.message || 'Unable to create report.' };
      reportId = String(created.id);
    }
  }

  return {
    share: {
      reportId,
      jobId: input.jobId,
      shareToken: token,
      shareUrl: `/report/${token}`,
      revoked: false
    },
    error: null
  };
}

export async function revokeJobReportShare(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase
    .from('job_reports')
    .update({ share_revoked_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .eq('job_id', jobId)
    .not('share_token', 'is', null);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export type PublicCustomerReport = {
  companyName: string;
  jobTitle: string;
  customerName: string | null;
  serviceAddress: string | null;
  completionDate: string | null;
  completionNotes: string | null;
  beforePhotos: Array<{ id: string; url: string; caption: string | null }>;
  afterPhotos: Array<{ id: string; url: string; caption: string | null }>;
  otherPhotos: Array<{ id: string; url: string; caption: string | null }>;
  locale: string | null;
};

const PUBLIC_JOB_FIELDS =
  'id, title, customer_name, address, completed_at, due_date, start_date, status, organization_id';

export async function fetchPublicCustomerReport(
  admin: SupabaseClient,
  token: string
): Promise<{ report: PublicCustomerReport | null; error: string | null; status: number }> {
  const { data: reportRow } = await admin
    .from('job_reports')
    .select(
      'id, job_id, organization_id, share_token, share_revoked_at, customer_completion_notes, report_locale, title'
    )
    .eq('share_token', token)
    .maybeSingle();

  if (!reportRow?.job_id || reportRow.share_revoked_at) {
    return { report: null, error: 'This report link is not available.', status: 404 };
  }

  const { data: job } = await admin
    .from('jobs')
    .select(PUBLIC_JOB_FIELDS)
    .eq('id', reportRow.job_id)
    .maybeSingle();

  if (!job) {
    return { report: null, error: 'This report link is not available.', status: 404 };
  }

  const { data: organization } = await admin
    .from('organizations')
    .select('name')
    .eq('id', job.organization_id)
    .maybeSingle();

  const photosRes = await admin
    .from('job_photos')
    .select(
      'id, storage_path, photo_type, label, customer_visible, customer_caption, public_url, created_at'
    )
    .eq('job_id', reportRow.job_id)
    .eq('customer_visible', true)
    .order('created_at', { ascending: true });

  const visibleRows = (photosRes.data || []) as JobPhotoRecord[];
  const withUrls = await attachSignedUrls(admin, visibleRows);

  const beforePhotos: PublicCustomerReport['beforePhotos'] = [];
  const afterPhotos: PublicCustomerReport['afterPhotos'] = [];
  const otherPhotos: PublicCustomerReport['otherPhotos'] = [];

  for (const photo of withUrls) {
    if (!photo.url) continue;
    const item = {
      id: photo.id,
      url: photo.url,
      caption: (photo as JobPhotoRecord & { customer_caption?: string | null }).customer_caption || null
    };
    const tag = String(photo.photo_type || photo.label || '').toLowerCase();
    if (tag === 'before') beforePhotos.push(item);
    else if (tag === 'after') afterPhotos.push(item);
    else otherPhotos.push(item);
  }

  const completionDate =
    (job.completed_at as string | null) ||
    (job.due_date as string | null) ||
    (job.start_date as string | null);

  return {
    report: {
      companyName: (organization?.name as string | null) || 'EverittOS',
      jobTitle: String(job.title || reportRow.title || 'Service report'),
      customerName: (job.customer_name as string | null) || null,
      serviceAddress: (job.address as string | null) || null,
      completionDate: completionDate ? String(completionDate).slice(0, 10) : null,
      completionNotes: (reportRow.customer_completion_notes as string | null) || null,
      beforePhotos,
      afterPhotos,
      otherPhotos,
      locale: (reportRow.report_locale as string | null) || null
    },
    error: null,
    status: 200
  };
}
