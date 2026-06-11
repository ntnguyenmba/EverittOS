import { appUrl } from '@/lib/app-url';
import { clientInviteEmailHtml, teamInviteEmailHtml } from '@/lib/email-templates';

export type EmailResult = { sent: boolean; message: string };

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function sendViaResend(to: string, subject: string, html: string): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { sent: false, message: 'Email provider not configured.' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, html })
  });

  if (!res.ok) {
    const body = await res.text();
    return { sent: false, message: body || 'Email send failed.' };
  }

  return { sent: true, message: 'Email sent.' };
}

export async function sendTeamInviteEmail(input: {
  to: string;
  organizationName: string;
  acceptUrl: string;
  role: string;
}): Promise<EmailResult> {
  if (!resendConfigured()) {
    return { sent: false, message: 'Email not configured. Copy the invite link below.' };
  }

  const subject = `You are invited to ${input.organizationName} on EverittOS`;
  const html = teamInviteEmailHtml({
    organizationName: input.organizationName,
    role: input.role,
    acceptUrl: input.acceptUrl
  });

  return sendViaResend(input.to, subject, html);
}

export async function sendClientInviteEmail(input: {
  to: string;
  organizationName: string;
  acceptUrl: string;
  jobTitle?: string;
  portalUrl?: string;
}): Promise<EmailResult> {
  if (!resendConfigured()) {
    return { sent: false, message: 'Email not configured. Copy the client link below.' };
  }

  const subject = `Client access to ${input.organizationName} on EverittOS`;
  const html = clientInviteEmailHtml({
    organizationName: input.organizationName,
    acceptUrl: input.acceptUrl,
    jobTitle: input.jobTitle,
    portalUrl: input.portalUrl
  });

  return sendViaResend(input.to, subject, html);
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
