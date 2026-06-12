import { NextResponse } from 'next/server';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json()) as {
    businessName?: string;
    phone?: string;
    serviceType?: string;
    bookingUrl?: string;
    website?: string;
    companyAddress?: string;
    email?: string;
    notifyAssignments?: boolean;
    notifyDueDates?: boolean;
    notifyCompletions?: boolean;
    notifyReports?: boolean;
    timezone?: string;
    teamSize?: string;
    industry?: string;
  };

  const businessName = body.businessName?.trim() || null;

  const { error: profileError } = await ctx.supabase
    .from('profiles')
    .update({ business_name: businessName })
    .eq('id', ctx.userId);

  if (profileError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(profileError.message) }, { status: 400 });
  }

  const { error: bizError } = await ctx.supabase.from('business_profiles').upsert({
    user_id: ctx.userId,
    business_name: businessName,
    phone: body.phone?.trim() || null,
    service_type: body.serviceType?.trim() || null,
    booking_url: body.bookingUrl?.trim() || null,
    email: body.email?.trim() || ctx.email
  });

  if (bizError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(bizError.message) }, { status: 400 });
  }

  const { error: settingsError } = await ctx.supabase.from('organization_settings').upsert({
    organization_id: ctx.workspace.organizationId,
    company_phone: body.phone?.trim() || null,
    company_email: body.email?.trim() || ctx.email,
    website: body.website?.trim() || null,
    company_address: body.companyAddress?.trim() || null,
    service_type: body.serviceType?.trim() || null,
    booking_url: body.bookingUrl?.trim() || null,
    notification_assignments: body.notifyAssignments ?? true,
    notification_due_dates: body.notifyDueDates ?? true,
    notification_completions: body.notifyCompletions ?? true,
    notification_reports: body.notifyReports ?? true,
    timezone: body.timezone?.trim() || 'America/New_York',
    team_size: body.teamSize?.trim() || null,
    industry: body.industry?.trim() || null
  });

  if (settingsError) {
    return NextResponse.json({ error: mapWorkspaceSaveError(settingsError.message) }, { status: 400 });
  }

  if (businessName) {
    const { error: orgError } = await ctx.supabase
      .from('organizations')
      .update({ name: businessName })
      .eq('id', ctx.workspace.organizationId);
    if (orgError) {
      return NextResponse.json({ error: mapWorkspaceSaveError(orgError.message) }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
