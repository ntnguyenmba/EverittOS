import { NextResponse } from 'next/server';
import { revokeApiKey } from '@/lib/api-keys';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { limitsForPlan } from '@/lib/everittos-limits';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { canManageOrganizationSettings } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageOrganizationSettings(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).apiAccess) {
    return NextResponse.json({ error: 'API access requires Growth or Enterprise.' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });

  const ok = await revokeApiKey(admin, id, org.organizationId);
  if (!ok) return NextResponse.json({ error: 'Key not found or already revoked' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
