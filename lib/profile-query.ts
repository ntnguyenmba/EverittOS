import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';

export const PROFILE_CORE_SELECT =
  'id, role, account_status, organization_id, business_name, email, deleted_at, deletion_scheduled_at' as const;

export const PROFILE_BILLING_SELECT = 'plan, subscription_status' as const;

export type ProfileRow = {
  id?: string;
  role?: string | null;
  plan?: string | null;
  account_status?: string | null;
  subscription_status?: string | null;
  organization_id?: string | null;
  business_name?: string | null;
  email?: string | null;
  deleted_at?: string | null;
  deletion_scheduled_at?: string | null;
};

export function isMissingColumnError(message: string): boolean {
  return /column\s+[\w.]+\s+does not exist/i.test(message);
}

export function parseMissingColumn(message: string): string | null {
  const match = message.match(/column\s+([\w.]+)\s+does not exist/i);
  return match?.[1] ?? null;
}

function withBillingDefaults(profile: ProfileRow | null): ProfileRow | null {
  if (!profile) return null;
  return {
    ...profile,
    plan: profile.plan?.trim() ? profile.plan : 'free',
    subscription_status: profile.subscription_status?.trim() ? profile.subscription_status : 'free'
  };
}

/** Load billing columns individually so one missing column does not wipe the other. */
async function fetchProfileBillingFields(
  client: SupabaseClient,
  userId: string
): Promise<{ plan?: string | null; subscription_status?: string | null }> {
  const billing: { plan?: string | null; subscription_status?: string | null } = {};

  const { data: planRow, error: planError } = await client
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle();
  if (!planError && planRow?.plan?.trim()) {
    billing.plan = planRow.plan;
  }

  const { data: statusRow, error: statusError } = await client
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .maybeSingle();
  if (!statusError && statusRow?.subscription_status?.trim()) {
    billing.subscription_status = statusRow.subscription_status;
  }

  return billing;
}

/** Read profile with fallback when billing columns are missing from production schema. */
export async function fetchProfileByUserId(
  client: SupabaseClient,
  userId: string
): Promise<{
  profile: ProfileRow | null;
  error?: string;
  schemaMismatch?: { column: string; message: string };
  usedCoreSelect: boolean;
}> {
  const fullSelect = `${PROFILE_CORE_SELECT}, ${PROFILE_BILLING_SELECT}`;
  const { data: fullProfile, error: fullError } = await client
    .from('profiles')
    .select(fullSelect)
    .eq('id', userId)
    .maybeSingle();

  if (!fullError) {
    return { profile: withBillingDefaults(fullProfile as ProfileRow), usedCoreSelect: false };
  }

  if (!isMissingColumnError(fullError.message)) {
    return { profile: null, error: fullError.message, usedCoreSelect: false };
  }

  const missingColumn = parseMissingColumn(fullError.message) || 'unknown';
  const { data: coreProfile, error: coreError } = await client
    .from('profiles')
    .select(PROFILE_CORE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (coreError) {
    return {
      profile: null,
      error: coreError.message,
      schemaMismatch: { column: missingColumn, message: fullError.message },
      usedCoreSelect: true
    };
  }

  const billing = await fetchProfileBillingFields(client, userId);

  return {
    profile: withBillingDefaults({ ...(coreProfile as ProfileRow), ...billing }),
    schemaMismatch: { column: missingColumn, message: fullError.message },
    usedCoreSelect: true
  };
}

export async function resolveProfilePlan(
  client: SupabaseClient,
  userId: string,
  profile?: ProfileRow | null
): Promise<EverittosPlan> {
  if (profile?.plan?.trim()) {
    return normalizePlan(profile.plan);
  }

  const { data: subscription, error } = await client
    .from('everittos_subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && subscription?.plan) {
    return normalizePlan(subscription.plan);
  }

  return 'free';
}

export async function resolveProfileSubscriptionStatus(
  client: SupabaseClient,
  userId: string,
  profile?: ProfileRow | null
): Promise<string> {
  if (profile?.subscription_status?.trim()) {
    return profile.subscription_status;
  }

  const { data: subscription, error } = await client
    .from('everittos_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && subscription?.status) {
    return subscription.status;
  }

  return 'free';
}

type ProfileWriteInput = {
  id: string;
  email: string;
  business_name: string;
  role: string;
  account_status: string;
  plan?: string;
  subscription_status?: string;
  organization_id?: string | null;
};

/** Upsert profile, omitting billing columns when they are not present in the database yet. */
export async function upsertProfileRow(
  client: SupabaseClient,
  input: ProfileWriteInput
): Promise<{ error?: string; schemaMismatch?: { column: string; message: string } }> {
  const fullPayload = {
    id: input.id,
    email: input.email,
    business_name: input.business_name,
    role: input.role,
    account_status: input.account_status,
    plan: input.plan || 'free',
    subscription_status: input.subscription_status || 'free',
    ...(input.organization_id !== undefined ? { organization_id: input.organization_id } : {})
  };

  const { error: fullError } = await client.from('profiles').upsert(fullPayload, { onConflict: 'id' });
  if (!fullError) return {};

  if (!isMissingColumnError(fullError.message)) {
    return { error: fullError.message };
  }

  const missingColumn = parseMissingColumn(fullError.message) || 'unknown';
  const corePayload = {
    id: input.id,
    email: input.email,
    business_name: input.business_name,
    role: input.role,
    account_status: input.account_status,
    ...(input.organization_id !== undefined ? { organization_id: input.organization_id } : {})
  };

  const { error: coreError } = await client.from('profiles').upsert(corePayload, { onConflict: 'id' });
  if (coreError) {
    return { error: coreError.message, schemaMismatch: { column: missingColumn, message: fullError.message } };
  }

  return { schemaMismatch: { column: missingColumn, message: fullError.message } };
}

export async function updateProfileLink(
  client: SupabaseClient,
  userId: string,
  organizationId: string,
  role: string
): Promise<{ profile: ProfileRow | null; error?: string; schemaMismatch?: { column: string; message: string } }> {
  const fullSelect = `${PROFILE_CORE_SELECT}, ${PROFILE_BILLING_SELECT}`;
  const { data, error } = await client
    .from('profiles')
    .update({ organization_id: organizationId, role })
    .eq('id', userId)
    .select(fullSelect)
    .single();

  if (!error) {
    return { profile: withBillingDefaults(data as ProfileRow) };
  }

  if (!isMissingColumnError(error.message)) {
    return { profile: null, error: error.message };
  }

  const missingColumn = parseMissingColumn(error.message) || 'unknown';
  const { data: coreData, error: coreError } = await client
    .from('profiles')
    .update({ organization_id: organizationId, role })
    .eq('id', userId)
    .select(PROFILE_CORE_SELECT)
    .single();

  if (coreError) {
    return {
      profile: null,
      error: coreError.message,
      schemaMismatch: { column: missingColumn, message: error.message }
    };
  }

  return {
    profile: withBillingDefaults(coreData as ProfileRow),
    schemaMismatch: { column: missingColumn, message: error.message }
  };
}
