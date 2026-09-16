import { appUrl } from '@/lib/app-url';
import { sendTransactionalEmail } from '@/lib/email-provider';
import { jobAssignedEmailHtml, renderEmailTemplate } from '@/lib/email-templates';

type SupabaseLike = {
  from: (table: string) => any;
};

type AssignmentKind = 'job' | 'customer' | 'lead';

type AssignmentNotificationInput = {
  supabase: SupabaseLike;
  organizationId: string;
  assignedUserId: string | null | undefined;
  title: string;
  kind: AssignmentKind;
  recordId: string;
  email?: string | null;
};

export type JobChangeReason = 'schedule' | 'address' | 'cancelled';

type JobChangeNotificationInput = {
  supabase: SupabaseLike;
  organizationId: string;
  assignedUserId: string | null | undefined;
  jobId: string;
  jobTitle: string;
  reasons: JobChangeReason[];
  email?: string | null;
};

function notificationTitle(kind: AssignmentKind) {
  if (kind === 'job') return 'Job assignment updated';
  if (kind === 'lead') return 'Lead assignment updated';
  return 'Customer assignment updated';
}

function notificationBody(kind: AssignmentKind, title: string) {
  if (kind === 'job') return title || 'Untitled job';
  if (kind === 'lead') return title || 'Untitled lead';
  return title || 'Untitled customer';
}

function recordUrl(kind: AssignmentKind, recordId: string) {
  if (kind === 'job') return appUrl(`/jobs/${recordId}`);
  if (kind === 'lead') return appUrl(`/leads/${recordId}`);
  return appUrl(`/customers/${recordId}`);
}

function assignmentEmailHtml(kind: AssignmentKind, title: string, url: string) {
  if (kind === 'job') {
    return jobAssignedEmailHtml({ jobTitle: title || 'Untitled job', jobUrl: url });
  }

  const label = kind === 'lead' ? 'lead' : 'customer';
  return renderEmailTemplate({
    title: `New ${label} assignment`,
    bodyHtml: `<p>You have been assigned to <strong>${title || `Untitled ${label}`}</strong>.</p>`,
    ctaLabel: `View ${label}`,
    ctaUrl: url
  });
}

async function resolveNotificationEmail(input: {
  supabase: SupabaseLike;
  assignedUserId: string;
  email?: string | null;
}) {
  let email = input.email?.trim() || '';
  if (!email) {
    const { data: profile } = await input.supabase
      .from('profiles')
      .select('email')
      .eq('id', input.assignedUserId)
      .maybeSingle();
    email = profile?.email?.trim() || '';
  }
  return email;
}

export async function sendAssignmentNotification(input: AssignmentNotificationInput): Promise<void> {
  if (!input.assignedUserId) return;

  const body = notificationBody(input.kind, input.title);
  const url = recordUrl(input.kind, input.recordId);

  await input.supabase.from('notifications').insert({
    organization_id: input.organizationId,
    user_id: input.assignedUserId,
    type: 'assignment',
    title: notificationTitle(input.kind),
    body,
    ...(input.kind === 'job' ? { related_job_id: input.recordId } : {})
  });

  const email = await resolveNotificationEmail({
    supabase: input.supabase,
    assignedUserId: input.assignedUserId,
    email: input.email
  });
  if (!email) return;

  await sendTransactionalEmail({
    to: email,
    subject: notificationTitle(input.kind),
    html: assignmentEmailHtml(input.kind, body, url)
  });
}

function jobChangeText(reasons: JobChangeReason[]) {
  const labels: string[] = [];
  if (reasons.includes('schedule')) labels.push('date or time');
  if (reasons.includes('address')) labels.push('address');
  if (reasons.includes('cancelled')) labels.push('status');
  return labels.join(', ');
}

export async function sendJobChangeNotification(input: JobChangeNotificationInput): Promise<void> {
  if (!input.assignedUserId || !input.reasons.length) return;

  const cancelled = input.reasons.includes('cancelled');
  const subject = cancelled ? 'Job cancelled' : 'Job details updated';
  const jobTitle = input.jobTitle || 'Untitled job';
  const changed = jobChangeText(input.reasons);
  const body = cancelled
    ? `${jobTitle} was cancelled.`
    : `${jobTitle} changed: ${changed}.`;
  const url = appUrl(`/jobs/${input.jobId}`);

  await input.supabase.from('notifications').insert({
    organization_id: input.organizationId,
    user_id: input.assignedUserId,
    type: 'job_update',
    title: subject,
    body,
    related_job_id: input.jobId
  });

  const email = await resolveNotificationEmail({
    supabase: input.supabase,
    assignedUserId: input.assignedUserId,
    email: input.email
  });
  if (!email) return;

  const bodyHtml = cancelled
    ? `<p><strong>${jobTitle}</strong> has been cancelled.</p>`
    : `<p><strong>${jobTitle}</strong> was updated.</p><p>Changed: ${changed}.</p>`;

  await sendTransactionalEmail({
    to: email,
    subject,
    html: renderEmailTemplate({
      title: subject,
      bodyHtml,
      ctaLabel: 'View job',
      ctaUrl: url
    })
  });
}
