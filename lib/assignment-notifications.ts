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

  let email = input.email?.trim() || '';
  if (!email) {
    const { data: profile } = await input.supabase.from('profiles').select('email').eq('id', input.assignedUserId).maybeSingle();
    email = profile?.email?.trim() || '';
  }

  if (!email) return;

  await sendTransactionalEmail({
    to: email,
    subject: notificationTitle(input.kind),
    html: assignmentEmailHtml(input.kind, body, url)
  });
}
