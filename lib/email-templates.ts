import { appUrl } from '@/lib/app-url';

const BRAND = {
  name: 'EverittOS',
  primary: '#2D3748',
  secondary: '#3A4658',
  background: '#F7F6F3',
  text: '#2A2A2A',
  muted: '#6B7280'
};

export type EmailTemplateInput = {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  organizationName?: string;
  supportEmail?: string;
  primaryColor?: string;
  secondaryColor?: string;
  locale?: string;
};

export function renderEmailTemplate(input: EmailTemplateInput): string {
  const primary = input.primaryColor || BRAND.primary;
  const secondary = input.secondaryColor || BRAND.secondary;
  const org = input.organizationName || BRAND.name;
  const support = input.supportEmail || 'support@everittventures.com';

  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<p style="margin:24px 0;"><a href="${input.ctaUrl}" style="background:${primary};color:#F7F6F3;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${input.ctaLabel}</a></p>`
      : '';

  const lang = input.locale || 'en';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><title>${input.title}</title></head>
<body style="margin:0;background:${BRAND.background};font-family:Inter,Segoe UI,sans-serif;color:${BRAND.text};">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <p style="font-size:13px;color:${BRAND.muted};margin:0 0 8px;">${org}</p>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 16px;color:${primary};">${input.title}</h1>
    ${input.preheader ? `<p style="color:${BRAND.muted};margin:0 0 16px;">${input.preheader}</p>` : ''}
    <div style="background:#fff;border:1px solid rgba(45,55,72,0.1);border-radius:10px;padding:24px;">
      ${input.bodyHtml}
      ${cta}
    </div>
    <p style="font-size:12px;color:${BRAND.muted};margin:24px 0 0;">Questions? Contact <a href="mailto:${support}" style="color:${secondary};">${support}</a></p>
    <p style="font-size:11px;color:${BRAND.muted};margin:8px 0 0;">EverittOS · ${appUrl('/')}</p>
  </div>
</body>
</html>`;
}

export function welcomeEmailHtml(name: string): string {
  return renderEmailTemplate({
    title: 'Welcome to EverittOS',
    preheader: 'Your workspace is ready.',
    bodyHtml: `<p>Hi ${name || 'there'},</p><p>Your EverittOS account is active. Create your first job, invite your team, and start tracking field work from one dashboard.</p>`,
    ctaLabel: 'Open dashboard',
    ctaUrl: appUrl('/dashboard')
  });
}

export function teamInviteEmailHtml(input: {
  organizationName: string;
  role: string;
  acceptUrl: string;
}): string {
  return renderEmailTemplate({
    title: `Join ${input.organizationName}`,
    organizationName: input.organizationName,
    bodyHtml: `<p>You have been invited to join <strong>${input.organizationName}</strong> as <strong>${input.role}</strong>.</p><p>Accept the invitation to access jobs, schedules, and reports.</p>`,
    ctaLabel: 'Accept invitation',
    ctaUrl: input.acceptUrl
  });
}

export function clientInviteEmailHtml(input: {
  organizationName: string;
  acceptUrl: string;
  jobTitle?: string;
  portalUrl?: string;
}): string {
  return renderEmailTemplate({
    title: 'Client portal access',
    organizationName: input.organizationName,
    bodyHtml: `<p>You have been granted client access to ${input.jobTitle ? `job <strong>${input.jobTitle}</strong>` : 'a job'} with ${input.organizationName}.</p>${input.portalUrl ? `<p>Portal: <a href="${input.portalUrl}">${input.portalUrl}</a></p>` : ''}`,
    ctaLabel: 'Accept and sign in',
    ctaUrl: input.acceptUrl
  });
}

export function invitationAcceptedEmailHtml(input: { memberEmail: string; organizationName: string }): string {
  return renderEmailTemplate({
    title: 'Team member joined',
    organizationName: input.organizationName,
    bodyHtml: `<p><strong>${input.memberEmail}</strong> accepted your invitation and joined ${input.organizationName}.</p>`
  });
}

export function passwordResetEmailNote(): string {
  return 'Password reset emails are sent by Supabase Auth using your configured template and redirect URL.';
}

export function trialEndingEmailHtml(daysLeft: number): string {
  return renderEmailTemplate({
    title: 'Your trial is ending soon',
    bodyHtml: `<p>Your EverittOS trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Upgrade to keep team management, activity logs, and advanced reporting.</p>`,
    ctaLabel: 'View billing',
    ctaUrl: appUrl('/settings/billing')
  });
}

export function paymentFailedEmailHtml(): string {
  return renderEmailTemplate({
    title: 'Payment failed',
    bodyHtml: '<p>We could not process your latest subscription payment. Update your billing details to avoid losing access to paid features.</p>',
    ctaLabel: 'Update billing',
    ctaUrl: appUrl('/settings/billing')
  });
}

export function subscriptionActivatedEmailHtml(plan: string): string {
  return renderEmailTemplate({
    title: 'Subscription activated',
    bodyHtml: `<p>Your <strong>${plan}</strong> subscription is now active. Thank you for choosing EverittOS.</p>`,
    ctaLabel: 'Open dashboard',
    ctaUrl: appUrl('/dashboard')
  });
}

export function subscriptionCanceledEmailHtml(): string {
  return renderEmailTemplate({
    title: 'Subscription canceled',
    bodyHtml: '<p>Your subscription is set to cancel at the end of the billing period. You can resume anytime from billing settings.</p>',
    ctaLabel: 'Manage billing',
    ctaUrl: appUrl('/settings/billing')
  });
}

export function reportAvailableEmailHtml(input: { jobTitle: string; reportUrl: string }): string {
  return renderEmailTemplate({
    title: 'Report available',
    bodyHtml: `<p>A report for <strong>${input.jobTitle}</strong> is ready to view.</p>`,
    ctaLabel: 'View report',
    ctaUrl: input.reportUrl
  });
}

export function jobAssignedEmailHtml(input: { jobTitle: string; jobUrl: string }): string {
  return renderEmailTemplate({
    title: 'New job assignment',
    bodyHtml: `<p>You have been assigned to <strong>${input.jobTitle}</strong>.</p>`,
    ctaLabel: 'View job',
    ctaUrl: input.jobUrl
  });
}

export const EMAIL_TEMPLATE_CATALOG = [
  'welcome',
  'invite_user',
  'invitation_accepted',
  'password_reset',
  'trial_ending',
  'payment_failed',
  'subscription_activated',
  'subscription_canceled',
  'report_available',
  'job_assigned'
] as const;
