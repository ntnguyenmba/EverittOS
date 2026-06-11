import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';
import { checkSupabaseConnectivity } from '@/lib/supabase-connectivity';
import { isSupabaseConfigured, supabaseConfigDiagnostics } from '@/lib/supabase-config';

export const runtime = 'nodejs';

export async function GET() {
  const diagnostics = supabaseConfigDiagnostics();
  const connectivity = await checkSupabaseConnectivity();

  if (!isSupabaseConfigured()) {
    const { json } = await createRouteHandlerSupabase();
    return json(
      {
        authenticated: false,
        error: 'Supabase is not configured.',
        diagnostics,
        connectivity
      },
      { status: 503 }
    );
  }

  const { supabase, json } = await createRouteHandlerSupabase();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return json({
      authenticated: false,
      error: userError?.message || 'No active session.',
      diagnostics,
      connectivity,
      session: { verified: false }
    });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, plan, account_status, subscription_status, organization_id')
    .eq('id', user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role, active')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  return json({
    authenticated: true,
    userId: user.id,
    email: user.email,
    diagnostics,
    connectivity,
    session: { verified: true },
    profile: profile
      ? {
          present: true,
          role: profile.role,
          plan: profile.plan,
          accountStatus: profile.account_status,
          subscriptionStatus: profile.subscription_status,
          organizationId: profile.organization_id
        }
      : { present: false },
    organization: {
      present: Boolean(profile?.organization_id || membership?.organization_id),
      membershipActive: Boolean(membership?.active)
    }
  });
}
