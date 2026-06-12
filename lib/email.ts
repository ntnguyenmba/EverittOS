import { appUrl } from '@/lib/app-url';
import { sendTransactionalEmail } from '@/lib/email-provider';
import { clientInviteEmailHtml, teamInviteEmailHtml } from '@/lib/email-templates';

export type EmailResult = { sent: boolean; message: string };

export async function sendTeamInviteEmail(input: {
  to: string;
  organizationName: string;
  acceptUrl: string;
  role: string;
}): Promise<EmailResult> {
  const subject = `You are invited to ${input.organizationName} on EverittOS`;
  const html = teamInviteEmailHtml({
    organizationName: input.organizationName,
    role: input.role,
    acceptUrl: input.acceptUrl
  });

  const result = await sendTransactionalEmail({ to: input.to, subject, html });
  if (!result.sent) {
    return { sent: false, message: 'Email not configured. Copy the invite link below.' };
  }
  return { sent: true, message: 'Email sent.' };
}

export async function sendClientInviteEmail(input: {
  to: string;
  organizationName: string;
  acceptUrl: string;
  jobTitle?: string;
  portalUrl?: string;
}): Promise<EmailResult> {
  const subject = `Client access to ${input.organizationName} on EverittOS`;
  const html = clientInviteEmailHtml({
    organizationName: input.organizationName,
    acceptUrl: input.acceptUrl,
    jobTitle: input.jobTitle,
    portalUrl: input.portalUrl
  });

  const result = await sendTransactionalEmail({ to: input.to, subject, html });
  if (!result.sent) {
    return { sent: false, message: 'Email not configured. Copy the client link below.' };
  }
  return { sent: true, message: 'Email sent.' };
}

export function clientPortalUrl(portalToken: string): string {
  return appUrl(`/portal/client?token=${portalToken}`);
}

export {
  welcomeEmailHtml,
  invitationAcceptedEmailHtml,
  trialEndingEmailHtml,
  paymentFailedEmailHtml,
  subscriptionActivatedEmailHtml,
  subscriptionCanceledEmailHtml,
  reportAvailableEmailHtml,
  jobAssignedEmailHtml,
  EMAIL_TEMPLATE_CATALOG
} from '@/lib/email-templates';
