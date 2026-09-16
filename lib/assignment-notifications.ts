import { appUrl } from '@/lib/app-url';
import { sendTransactionalEmail } from '@/lib/email-provider';
import { renderEmailTemplate } from '@/lib/email-templates';
import { normalizeLocale, type Locale } from '@/lib/i18n/config';
import {
  getAssignmentNotificationCopy,
  type AssignmentNotificationKind,
  type JobChangeReasonKey
} from '@/lib/i18n/assignment-notification-copy';

type SupabaseLike = {
  from: (table: string) => any;
};

type AssignmentKind = AssignmentNotificationKind;

type AssignmentNotificationInput = {
  supabase: SupabaseLike;
  organizationId: string;
  assignedUserId: string | null | undefined;
  title: string;
  kind: AssignmentKind;
  recordId: string;
  email?: string | null;
};

export type JobChangeReason = JobChangeReasonKey;

type JobChangeNotificationInput = {
  supabase: SupabaseLike;
  organizationId: string;
  assignedUserId: string | null | undefined;
  jobId: string;
  jobTitle: string;
  reasons: JobChangeReason[];
  email?: string | null;
};

function recordUrl(kind: AssignmentKind, recordId: string) {
  if (kind === 'job') return appUrl(`/jobs/${recordId}`);
  if (kind === 'lead') return appUrl(`/leads/${recordId}`);
  return appUrl(`/customers/${recordId}`);
}

async function resolveRecipient(input: {
  supabase: SupabaseLike;
  assignedUserId: string;
  email?: string | null;
}): Promise<{ email: string; locale: Locale }> {
  const { data: profile } = await input.supabase
    .from('profiles')
    .select('email, locale')
    .eq('id', input.assignedUserId)
    .maybeSingle();

  return {
    email: input.email?.trim() || profile?.email?.trim() || '',
    locale: normalizeLocale(profile?.locale)
  };
}

export async function sendAssignmentNotification(input: AssignmentNotificationInput): Promise<void> {
  if (!input.assignedUserId) return;

  const recipient = await resolveRecipient({
    supabase: input.supabase,
    assignedUserId: input.assignedUserId,
    email: input.email
  });
  const copy = getAssignmentNotificationCopy(recipient.locale);
  const title = input.title?.trim() || copy.untitled[input.kind];
  const subject = copy.assignmentTitle[input.kind];
  const url = recordUrl(input.kind, input.recordId);

  await input.supabase.from('notifications').insert({
    organization_id: input.organizationId,
    user_id: input.assignedUserId,
    type: 'assignment',
    title: subject,
    body: title,
    ...(input.kind === 'job' ? { related_job_id: input.recordId } : {})
  });

  if (!recipient.email) return;

  await sendTransactionalEmail({
    to: recipient.email,
    subject,
    html: renderEmailTemplate({
      title: subject,
      bodyHtml: `<p>${copy.assignedBody(input.kind, `<strong>${title}</strong>`)}</p>`,
      ctaLabel: copy.viewLabel[input.kind],
      ctaUrl: url
    })
  });
}

function jobChangeText(reasons: JobChangeReason[], locale: Locale) {
  const copy = getAssignmentNotificationCopy(locale);
  return reasons.map((reason) => copy.changeLabels[reason]).join(', ');
}

export async function sendJobChangeNotification(input: JobChangeNotificationInput): Promise<void> {
  if (!input.assignedUserId || !input.reasons.length) return;

  const recipient = await resolveRecipient({
    supabase: input.supabase,
    assignedUserId: input.assignedUserId,
    email: input.email
  });
  const copy = getAssignmentNotificationCopy(recipient.locale);
  const cancelled = input.reasons.includes('cancelled');
  const subject = cancelled ? copy.cancelledTitle : copy.updatedTitle;
  const jobTitle = input.jobTitle?.trim() || copy.untitled.job;
  const changed = jobChangeText(input.reasons, recipient.locale);
  const body = cancelled ? copy.cancelledBody(jobTitle) : copy.updatedBody(jobTitle, changed);
  const url = appUrl(`/jobs/${input.jobId}`);

  await input.supabase.from('notifications').insert({
    organization_id: input.organizationId,
    user_id: input.assignedUserId,
    type: 'job_update',
    title: subject,
    body,
    related_job_id: input.jobId
  });

  if (!recipient.email) return;

  const bodyHtml = cancelled
    ? `<p>${copy.cancelledBody(`<strong>${jobTitle}</strong>`)}</p>`
    : `<p>${copy.updatedBody(`<strong>${jobTitle}</strong>`, changed)}</p>`;

  await sendTransactionalEmail({
    to: recipient.email,
    subject,
    html: renderEmailTemplate({
      title: subject,
      bodyHtml,
      ctaLabel: copy.viewJob,
      ctaUrl: url
    })
  });
}
