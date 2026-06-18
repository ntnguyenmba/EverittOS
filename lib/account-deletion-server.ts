import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlan } from '@/lib/everittos-plans';
import { ACCOUNT_DELETION_RECOVERY_DAYS, deletionScheduledAt } from '@/lib/deletion-policy';
import { logSecurityEvent } from '@/lib/security-events';
import { isOwner, normalizeRole } from '@/lib/roles';
import { normalizeStripeStatus } from '@/lib/stripe-subscription';

export async function verifyAccountPassword(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
  'incomplete'
]);

/** Blocks self-service deletion while a paid Stripe subscription is still active. */
export function subscriptionBlocksAccountDeletion(
  planInput: string | null | undefined,
  statusInput: string | null | undefined
): boolean {
  if (normalizePlan(planInput) === 'free') return false;
  const status = normalizeStripeStatus(statusInput);
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

export async function clearPersonalAccountData(admin: SupabaseClient, userId: string): Promise<void> {
  await Promise.all([
    admin.from('notifications').delete().eq('user_id', userId),
    admin
      .from('profiles')
      .update({
        marketing_emails: false,
        product_updates: false,
        operational_notifications: false,
        email_notifications: false,
        push_notifications: false,
        sms_notifications: false
      })
      .eq('id', userId)
  ]);
}

async function purgeUserOwnedRecords(
  admin: SupabaseClient,
  userId: string,
  email: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  await Promise.all([
    admin.from('notifications').delete().eq('user_id', userId),
    admin.from('everittos_subscriptions').delete().eq('user_id', userId),
    admin.from('organization_members').delete().eq('user_id', userId),
    admin.from('department_memberships').delete().eq('user_id', userId),
    admin.from('business_profiles').delete().eq('user_id', userId),
    admin.from('ai_usage_events').delete().eq('user_id', userId),
    admin.from('security_events').delete().eq('user_id', userId),
    admin.from('job_client_access').delete().eq('client_user_id', userId)
  ]);

  await admin.from('workers').update({ auth_user_id: null }).eq('auth_user_id', userId);

  if (normalizedEmail) {
    await admin.from('organization_invitations').delete().eq('email', normalizedEmail);
  }
}

export async function permanentlyDeletePersonalAccount(input: {
  admin: SupabaseClient;
  userId: string;
  email: string;
  role: string;
  organizationId: string | null;
  plan: string | null | undefined;
  subscriptionStatus: string | null | undefined;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const { admin, userId, email, role, organizationId, plan, subscriptionStatus } = input;

  if (subscriptionBlocksAccountDeletion(plan, subscriptionStatus)) {
    return {
      ok: false,
      code: 'active_subscription',
      error: 'Active subscriptions must be cancelled before account deletion.'
    };
  }

  const allowed = await canDeletePersonalAccount(admin, userId, role, organizationId);
  if (!allowed.ok) {
    return { ok: false, error: allowed.error };
  }

  await purgeUserOwnedRecords(admin, userId, email);

  if (organizationId) {
    await admin.from('activity_logs').insert({
      organization_id: organizationId,
      actor_id: userId,
      actor_name: email,
      entity_type: 'account',
      entity_id: userId,
      action: 'account_permanently_deleted',
      message: 'User permanently deleted their account.'
    });
  }

  await logSecurityEvent({
    organizationId,
    userId,
    eventType: 'account_disabled',
    severity: 'warn',
    message: 'Account permanently deleted by user.'
  });

  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    return { ok: false, error: authError.message || 'Unable to delete authentication account.' };
  }

  return { ok: true };
}

export async function canDeletePersonalAccount(
  admin: SupabaseClient,
  userId: string,
  role: string,
  organizationId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isOwner(normalizeRole(role)) || !organizationId) {
    return { ok: true };
  }

  const { data: org } = await admin
    .from('organizations')
    .select('owner_user_id')
    .eq('id', organizationId)
    .maybeSingle();

  if (org?.owner_user_id !== userId) {
    return { ok: true };
  }

  const { count } = await admin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .neq('user_id', userId);

  if ((count || 0) > 0) {
    return {
      ok: false,
      error:
        'Transfer workspace ownership or delete the workspace before deleting your owner account.'
    };
  }

  return { ok: true };
}

export async function scheduleAccountDeletion(input: {
  supabase: SupabaseClient;
  admin: SupabaseClient | null;
  userId: string;
  email: string;
  organizationId: string | null;
}): Promise<{ deletionScheduledAt: string } | { error: string }> {
  const { supabase, admin, userId, email, organizationId } = input;
  const now = new Date();
  const scheduled = deletionScheduledAt(now, ACCOUNT_DELETION_RECOVERY_DAYS);

  const { error } = await supabase
    .from('profiles')
    .update({
      deleted_at: now.toISOString(),
      deletion_scheduled_at: scheduled.toISOString(),
      account_status: 'disabled'
    })
    .eq('id', userId);

  if (error) return { error: error.message };

  if (admin) {
    await clearPersonalAccountData(admin, userId);

    if (organizationId) {
      await admin.from('activity_logs').insert({
        organization_id: organizationId,
        actor_id: userId,
        actor_name: email,
        entity_type: 'account',
        entity_id: userId,
        action: 'account_soft_deleted',
        message: `Account scheduled for deletion after ${ACCOUNT_DELETION_RECOVERY_DAYS}-day recovery window.`
      });
    }

    await logSecurityEvent({
      organizationId,
      userId,
      eventType: 'account_disabled',
      severity: 'warn',
      message: 'Account scheduled for deletion.'
    });
  }

  return { deletionScheduledAt: scheduled.toISOString() };
}

export async function restorePersonalAccount(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('deleted_at, deletion_scheduled_at')
    .eq('id', userId)
    .maybeSingle();

  if (!profile?.deleted_at) {
    return { ok: false, error: 'This account is not scheduled for deletion.' };
  }

  if (profile.deletion_scheduled_at && new Date(profile.deletion_scheduled_at) <= new Date()) {
    return { ok: false, error: 'The recovery window for this account has expired.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      deleted_at: null,
      deletion_scheduled_at: null,
      account_status: 'active'
    })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
