import { NextResponse } from 'next/server';
import { createApiKey, listApiKeys } from '@/lib/api-keys';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { limitsForPlan } from '@/lib/everittos-limits';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { canManageOrganizationSettings } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
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

  const keys = await listApiKeys(admin, org.organizationId);
  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      key_prefix: k.key_prefix,
      scopes: k.scopes,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
      revoked_at: k.revoked_at
    }))
  });
}

export async function POST(request: Request) {
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

  const body = (await request.json()) as { name?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });

  const { row, rawKey } = await createApiKey(admin, {
    organizationId: org.organizationId,
    name: body.name,
    createdBy: user.id
  });

  return NextResponse.json({
    key: {
      id: row.id,
      name: row.name,
      key_prefix: row.key_prefix,
      created_at: row.created_at
    },
    rawKey
  });
}
