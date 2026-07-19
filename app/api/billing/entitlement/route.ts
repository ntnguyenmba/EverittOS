import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { resolveOrganizationEntitlement } from '@/lib/billing/entitlements';
import { publicStoreProductIds } from '@/lib/billing/product-catalog';

export const runtime = 'nodejs';

/** Return the authoritative entitlement for the signed-in user's organization. */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const orgContext = await fetchOrganizationContextForUser(supabase, user.id);
  const organizationId = profile?.organization_id || orgContext?.organizationId || null;
  if (!organizationId) {
    return NextResponse.json({
      plan: 'free',
      source: 'free',
      status: 'free',
      expiresAt: null,
      productIds: {
        ios: publicStoreProductIds('ios'),
        android: publicStoreProductIds('android')
      }
    });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server billing configuration is incomplete.' }, { status: 503 });
  }

  const entitlement = await resolveOrganizationEntitlement(admin, organizationId);
  return NextResponse.json({
    ...entitlement,
    organizationId,
    productIds: {
      ios: publicStoreProductIds('ios'),
      android: publicStoreProductIds('android')
    }
  });
}
