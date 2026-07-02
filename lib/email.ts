import { appUrl } from '@/lib/app-url';
import { sendTransactionalEmail } from '@/lib/email-provider';
import { clientInviteEmailHtml, teamInviteEmailHtml } from '@/lib/email-templates';

export type EmailResult = { sent: boolean; message: string };

function emailFailureMessage(error?: string): string {
  if (!error) return 'Email is not configured yet. Copy the invite link below.';

  const normalized = error.toLowerCase();
  if (normalized.includes('domain is not verified') || normalized.includes('resend.com/domains') || normalized.includes('validation_error')) {
    return 'Email could not be sent because the sending domain is not verified in Resend. Verify everittventures.com in Resend Domains, then try again.';
  }

  if (normalized.includes('api key') || normalized.includes('unauthorized') || normalized.includes('forbidden')) {
    return 'Email could not be sent because the email provider is not configured correctly. Check RESEND_API_KEY and EMAIL_FROM in Vercel.';
  }

  return 'Email could not be sent. Check the email provider settings, then try again.';
}

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
    return { sent: false, message: emailFailureMessage(result.error) };
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
    return { sent: false, message: emailFailureMessage(result.error) };
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
