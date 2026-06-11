import type { AppLocale } from '@/i18n/routing';
import { appUrl } from '@/lib/app-url';
import { translateMessage, translatedRoleName } from '@/lib/i18n-messages';
import { renderEmailTemplate } from '@/lib/email-templates';

export function localizedWelcomeEmailHtml(locale: AppLocale, name: string): string {
  return renderEmailTemplate({
    title: translateMessage(locale, 'emails.welcomeTitle'),
    preheader: translateMessage(locale, 'emails.welcomePreheader'),
    bodyHtml: `<p>${translateMessage(locale, 'emails.welcomeBody', { name: name || 'there' })}</p>`,
    ctaLabel: translateMessage(locale, 'emails.openDashboard'),
    ctaUrl: appUrl('/dashboard'),
    locale
  });
}

export function localizedTeamInviteEmailHtml(
  locale: AppLocale,
  input: { organizationName: string; role: string; acceptUrl: string }
): string {
  const roleLabel = translatedRoleName(locale, input.role);
  return renderEmailTemplate({
    title: translateMessage(locale, 'emails.teamInviteTitle', { organization: input.organizationName }),
    organizationName: input.organizationName,
    bodyHtml: `<p>${translateMessage(locale, 'emails.teamInviteBody', {
      organization: input.organizationName,
      role: roleLabel
    })}</p>`,
    ctaLabel: translateMessage(locale, 'emails.acceptInvitation'),
    ctaUrl: input.acceptUrl,
    locale
  });
}

export function localizedClientInviteEmailHtml(
  locale: AppLocale,
  input: { organizationName: string; acceptUrl: string; jobTitle?: string; portalUrl?: string }
): string {
  const bodyKey = input.jobTitle ? 'emails.clientInviteBodyJob' : 'emails.clientInviteBodyGeneral';
  const body = translateMessage(locale, bodyKey, {
    organization: input.organizationName,
    job: input.jobTitle || ''
  });

  return renderEmailTemplate({
    title: translateMessage(locale, 'emails.clientInviteTitle'),
    organizationName: input.organizationName,
    bodyHtml: `<p>${body}</p>${input.portalUrl ? `<p>Portal: <a href="${input.portalUrl}">${input.portalUrl}</a></p>` : ''}`,
    ctaLabel: translateMessage(locale, 'emails.acceptAndSignIn'),
    ctaUrl: input.acceptUrl,
    locale
  });
}

export function localizedInvitationAcceptedEmailHtml(
  locale: AppLocale,
  input: { memberEmail: string; organizationName: string }
): string {
  return renderEmailTemplate({
    title: translateMessage(locale, 'emails.memberJoinedTitle'),
    organizationName: input.organizationName,
    bodyHtml: `<p>${translateMessage(locale, 'emails.memberJoinedBody', {
      email: input.memberEmail,
      organization: input.organizationName
    })}</p>`,
    locale
  });
}

export function localizedTrialEndingEmailHtml(locale: AppLocale, daysLeft: number): string {
  return renderEmailTemplate({
    title: translateMessage(locale, 'emails.trialEndingTitle'),
    bodyHtml: `<p>${translateMessage(locale, 'emails.trialEndingBody', { days: daysLeft })}</p>`,
    ctaLabel: translateMessage(locale, 'emails.viewBilling'),
    ctaUrl: appUrl('/settings/billing'),
    locale
  });
}

export function localizedPaymentFailedEmailHtml(locale: AppLocale): string {
  return renderEmailTemplate({
    title: translateMessage(locale, 'emails.paymentFailedTitle'),
    bodyHtml: `<p>${translateMessage(locale, 'emails.paymentFailedBody')}</p>`,
    ctaLabel: translateMessage(locale, 'emails.updateBilling'),
    ctaUrl: appUrl('/settings/billing'),
    locale
  });
}

export function localizedSubscriptionActivatedEmailHtml(locale: AppLocale, plan: string): string {
  return renderEmailTemplate({
    title: translateMessage(locale, 'emails.subscriptionActivatedTitle'),
    bodyHtml: `<p>${translateMessage(locale, 'emails.subscriptionActivatedBody', { plan })}</p>`,
    ctaLabel: translateMessage(locale, 'emails.openDashboard'),
    ctaUrl: appUrl('/dashboard'),
    locale
  });
}

export function localizedSubscriptionCanceledEmailHtml(locale: AppLocale): string {
  return renderEmailTemplate({
    title: translateMessage(locale, 'emails.subscriptionCanceledTitle'),
    bodyHtml: `<p>${translateMessage(locale, 'emails.subscriptionCanceledBody')}</p>`,
    ctaLabel: translateMessage(locale, 'emails.manageBilling'),
    ctaUrl: appUrl('/settings/billing'),
    locale
  });
}

export function localizedReportAvailableEmailHtml(
  locale: AppLocale,
  input: { jobTitle: string; reportUrl: string }
): string {
  return renderEmailTemplate({
    title: translateMessage(locale, 'emails.reportAvailableTitle'),
    bodyHtml: `<p>${translateMessage(locale, 'emails.reportAvailableBody', { job: input.jobTitle })}</p>`,
    ctaLabel: translateMessage(locale, 'emails.viewReport'),
    ctaUrl: input.reportUrl,
    locale
  });
}

export function localizedJobAssignedEmailHtml(
  locale: AppLocale,
  input: { jobTitle: string; jobUrl: string }
): string {
  return renderEmailTemplate({
    title: translateMessage(locale, 'emails.jobAssignedTitle'),
    bodyHtml: `<p>${translateMessage(locale, 'emails.jobAssignedBody', { job: input.jobTitle })}</p>`,
    ctaLabel: translateMessage(locale, 'emails.viewJob'),
    ctaUrl: input.jobUrl,
    locale
  });
}

export function localizedTeamInviteSubject(locale: AppLocale, organizationName: string): string {
  return translateMessage(locale, 'emails.teamInviteTitle', { organization: organizationName });
}

export function localizedClientInviteSubject(locale: AppLocale, organizationName: string): string {
  return `${translateMessage(locale, 'emails.clientInviteTitle')} — ${organizationName}`;
}
