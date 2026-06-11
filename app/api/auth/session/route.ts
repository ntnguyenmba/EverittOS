import { logAuthStep } from '@/lib/auth-diagnostics';
import {
  fetchProfileByUserId,
  isMissingColumnError,
  resolveProfilePlan,
  resolveProfileSubscriptionStatus
} from '@/lib/profile-query';
import { createRouteHandlerSupabase } from '@/lib/supabase-route-client';
import { checkSupabaseConnectivity } from '@/lib/supabase-connectivity';
import { isSupabaseConfigured, supabaseConfigDiagnostics } from '@/lib/supabase-config';

export const runtime = 'nodejs';

const ROUTE = 'session';

export async function GET() {
  const diagnostics = supabaseConfigDiagnostics();

  logAuthStep(ROUTE, 'config_check', {
    configured: diagnostics.configured ? 1 : 0,
    host: diagnostics.urlHost || 'missing'
  });

  if (!isSupabaseConfigured()) {
    const { json } = await createRouteHandlerSupabase();
    return json(
      {
        authenticated: false,
        error: 'Supabase is not configured.',
        code: 'config_error',
        diagnostics,
        connectivity: { ok: false, error: 'Supabase is not configured.' }
      },
      { status: 503 }
    );
  }

  logAuthStep(ROUTE, 'connectivity', { host: diagnostics.urlHost || 'unknown' });
  const connectivity = await checkSupabaseConnectivity();
  if (!connectivity.ok) {
    const { json } = await createRouteHandlerSupabase();
    return json(
      {
        authenticated: false,
        error: 'Cannot reach Supabase from this deployment.',
        code: 'supabase_unreachable',
        supabaseMessage: connectivity.error,
        diagnostics,
        connectivity
      },
      { status: 503 }
    );
  }

  const { supabase, json } = await createRouteHandlerSupabase();

  logAuthStep(ROUTE, 'session_verify');
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return json({
      authenticated: false,
      error: userError?.message || 'No active session.',
      code: userError ? 'session_error' : 'no_session',
      supabaseMessage: userError?.message,
      diagnostics,
      connectivity,
      session: { verified: false }
    });
  }

  logAuthStep(ROUTE, 'profile_lookup', { userId: user.id });
  const profileRead = await fetchProfileByUserId(supabase, user.id);

  if (profileRead.error) {
    const code = isMissingColumnError(profileRead.error) ? 'schema_mismatch' : 'profile_read_failed';
    return json(
      {
        authenticated: true,
        userId: user.id,
        email: user.email,
        error: code === 'schema_mismatch' ? 'Profile schema mismatch.' : 'Profile lookup failed.',
        code,
        supabaseMessage: profileRead.error,
        diagnostics,
        connectivity,
        session: { verified: true },
        profile: { present: false, lookupRan: true, error: profileRead.error },
        organization: { lookupRan: false, skipped: true, reason: 'Profile lookup failed first.' }
      },
      { status: code === 'schema_mismatch' ? 503 : 500 }
    );
  }

  const profile = profileRead.profile;
  const plan = profile ? await resolveProfilePlan(supabase, user.id, profile) : 'free';
  const subscriptionStatus = profile
    ? await resolveProfileSubscriptionStatus(supabase, user.id, profile)
    : 'free';

  logAuthStep(ROUTE, 'membership_lookup', { userId: user.id });
  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id, role, active')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return json(
      {
        authenticated: true,
        userId: user.id,
        email: user.email,
        error: 'Organization membership lookup failed.',
        code: 'membership_read_failed',
        supabaseMessage: membershipError.message,
        diagnostics,
        connectivity,
        session: { verified: true },
        profile: profile
          ? {
              present: true,
              lookupRan: true,
              role: profile.role,
              plan,
              accountStatus: profile.account_status,
              subscriptionStatus,
              organizationId: profile.organization_id
            }
          : { present: false, lookupRan: true },
        organization: { lookupRan: true, error: membershipError.message }
      },
      { status: 500 }
    );
  }

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
          lookupRan: true,
          role: profile.role,
          plan,
          accountStatus: profile.account_status,
          subscriptionStatus,
          organizationId: profile.organization_id,
          schemaFallback: profileRead.usedCoreSelect || undefined
        }
      : { present: false, lookupRan: true },
    organization: {
      present: Boolean(profile?.organization_id || membership?.organization_id),
      lookupRan: true,
      membershipActive: Boolean(membership?.active)
    }
  });
}
