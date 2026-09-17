import { NextResponse } from 'next/server';
import { revokeApiKey } from '@/lib/api-keys';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { limitsForPlan } from '@/lib/everittos-limits';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { canManageOrganizationSettings } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getMiscApiCopy } from '@/lib/i18n/misc-api-copy';

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: RouteParams) {
  const c = getMiscApiCopy(localeFromRequest(request));
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageOrganizationSettings(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).apiAccess) return NextResponse.json({ error: c.apiAccessPlan }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });

  const ok = await revokeApiKey(admin, id, org.organizationId);
  if (!ok) return NextResponse.json({ error: c.keyNotFound }, { status: 404 });

  return NextResponse.json({ ok: true });
}
