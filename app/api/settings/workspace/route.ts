import { NextResponse } from 'next/server';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { logSecurityEvent, requestClientMeta } from '@/lib/security-events';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { isValidTimeZone } from '@/lib/time-zones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAYMENT_METHODS = new Set(['', 'stripe', 'square', 'paypal', 'venmo', 'zelle', 'cash_app', 'custom']);

function validPaymentLink(value?: string): string | null {
  const link = value?.trim() || '';
  if (!link) return null;
  try {
    const url = new URL(link);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function PATCH(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  const body = (await request.json()) as { businessName?: string; legalBusinessName?: string; phone?: string; businessEmail?: string; serviceType?: string; bookingUrl?: string; website?: string; companyAddress?: string; email?: string; notifyAssignments?: boolean; notifyDueDates?: boolean; notifyCompletions?: boolean; notifyReports?: boolean; timezone?: string; teamSize?: string; industry?: string; taxId?: string; invoiceFooter?: string; defaultCustomerMessage?: string; teamDisplayName?: string; brandPrimaryColor?: string; brandAccentColor?: string; preferredPaymentMethod?: string; paymentLink?: string; paymentInstructions?: string; };
  const businessName = body.businessName?.trim() || null;
  const businessEmail = body.businessEmail?.trim() || body.email?.trim() || ctx.email;
  const requestedTimeZone = body.timezone?.trim() || '';
  if (requestedTimeZone && !isValidTimeZone(requestedTimeZone)) return NextResponse.json({ error: 'Choose a valid timezone.' }, { status: 400 });
  const preferredPaymentMethod = (body.preferredPaymentMethod || '').trim().toLowerCase();
  if (!PAYMENT_METHODS.has(preferredPaymentMethod)) return NextResponse.json({ error: 'Choose a valid payment method.' }, { status: 400 });
  const rawPaymentLink = body.paymentLink?.trim() || '';
  const paymentLink = validPaymentLink(rawPaymentLink);
  if (rawPaymentLink && !paymentLink) return NextResponse.json({ error: 'Payment link must be a valid https:// address.' }, { status: 400 });
  const { data: existingSettings } = await ctx.supabase.from('organization_settings').select('timezone').eq('organization_id', ctx.workspace.organizationId).maybeSingle();
  const timezone = requestedTimeZone || (isValidTimeZone(existingSettings?.timezone) ? existingSettings.timezone : 'UTC');
  const { data: beforeOrg } = await ctx.supabase.from('organizations').select('name').eq('id', ctx.workspace.organizationId).maybeSingle();
  const { error: profileError } = await ctx.supabase.from('profiles').update({ business_name: businessName }).eq('id', ctx.userId);
  if (profileError) return NextResponse.json({ error: mapWorkspaceSaveError(profileError.message) }, { status: 400 });
  const { error: bizError } = await ctx.supabase.from('business_profiles').upsert({ user_id: ctx.userId, business_name: businessName, phone: body.phone?.trim() || null, service_type: body.serviceType?.trim() || null, booking_url: body.bookingUrl?.trim() || null, email: businessEmail });
  if (bizError) return NextResponse.json({ error: mapWorkspaceSaveError(bizError.message) }, { status: 400 });
  const { error: settingsError } = await ctx.supabase.from('organization_settings').upsert({ organization_id: ctx.workspace.organizationId, company_phone: body.phone?.trim() || null, company_email: businessEmail, website: body.website?.trim() || null, company_address: body.companyAddress?.trim() || null, service_type: body.serviceType?.trim() || null, booking_url: body.bookingUrl?.trim() || null, notification_assignments: body.notifyAssignments ?? true, notification_due_dates: body.notifyDueDates ?? true, notification_completions: body.notifyCompletions ?? true, notification_reports: body.notifyReports ?? true, timezone, team_size: body.teamSize?.trim() || null, industry: body.industry?.trim() || null, legal_business_name: body.legalBusinessName?.trim() || null, tax_id: body.taxId?.trim() || null, invoice_footer: body.invoiceFooter?.trim() || null, default_customer_message: body.defaultCustomerMessage?.trim() || null, team_display_name: body.teamDisplayName?.trim() || null, brand_primary_color: body.brandPrimaryColor?.trim() || null, brand_accent_color: body.brandAccentColor?.trim() || null, preferred_payment_method: preferredPaymentMethod || null, payment_link: paymentLink, payment_instructions: body.paymentInstructions?.trim() || null });
  if (settingsError) return NextResponse.json({ error: mapWorkspaceSaveError(settingsError.message) }, { status: 400 });
  if (businessName) { const { error: orgError } = await ctx.supabase.from('organizations').update({ name: businessName }).eq('id', ctx.workspace.organizationId); if (orgError) return NextResponse.json({ error: mapWorkspaceSaveError(orgError.message) }, { status: 400 }); }
  const meta = requestClientMeta(request);
  if (beforeOrg?.name && businessName && beforeOrg.name !== businessName) {
    await logWorkspaceActivity(ctx.workspace.organizationId, ctx.userId, 'organization', ctx.workspace.organizationId, 'business_name_changed', `Business name changed to ${businessName}`);
    await logSecurityEvent({ organizationId: ctx.workspace.organizationId, userId: ctx.userId, eventType: 'suspicious_activity', severity: 'info', message: 'Workspace business name updated.', ipAddress: meta.ipAddress, userAgent: meta.userAgent, metadata: { previousName: beforeOrg.name, nextName: businessName } });
  } else {
    await logWorkspaceActivity(ctx.workspace.organizationId, ctx.userId, 'settings', ctx.workspace.organizationId, 'user_updated', 'Workspace settings saved');
  }
  return NextResponse.json({ ok: true, message: 'Workspace settings saved.', timezone });
}
