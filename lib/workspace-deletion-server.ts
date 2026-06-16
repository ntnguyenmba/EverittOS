import type { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { WORKSPACE_DELETION_RECOVERY_DAYS, deletionScheduledAt } from '@/lib/deletion-policy';
import { logSecurityEvent } from '@/lib/security-events';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { isValidStripeSubscriptionId } from '@/lib/stripe-ids';

export type WorkspaceDeletionPreview = {
  organizationId: string;
  organizationName: string;
  customers: number;
  jobs: number;
  leads: number;
  invoices: number;
  bookings: number;
  files: number;
  teamMembers: number;
  hasActivePaidSubscription: boolean;
  subscriptionStatus: string | null;
};

async function safeCount(
  admin: SupabaseClient,
  table: string,
  organizationId: string,
  column = 'organization_id'
): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, organizationId);
  if (error) return 0;
  return count || 0;
}

export async function fetchWorkspaceDeletionPreview(
  admin: SupabaseClient,
  organizationId: string
): Promise<WorkspaceDeletionPreview | null> {
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, owner_user_id')
    .eq('id', organizationId)
    .maybeSingle();

  if (!org) return null;

  const [customers, jobs, leads, invoices, bookings, photos, teamMembers, ownerProfile] = await Promise.all([
    safeCount(admin, 'customers', organizationId),
    safeCount(admin, 'jobs', organizationId),
    safeCount(admin, 'leads', organizationId),
    safeCount(admin, 'invoices', organizationId),
    safeCount(admin, 'bookings', organizationId),
    safeCount(admin, 'job_photos', organizationId),
    safeCount(admin, 'organization_members', organizationId),
    admin.from('profiles').select('subscription_status, plan').eq('id', org.owner_user_id).maybeSingle()
  ]);

  const subscriptionStatus = ownerProfile.data?.subscription_status || null;
  const plan = ownerProfile.data?.plan || 'free';
  const hasActivePaidSubscription =
    plan !== 'free' &&
    Boolean(subscriptionStatus) &&
    !['canceled', 'cancelled', 'free'].includes(String(subscriptionStatus).toLowerCase());

  return {
    organizationId: org.id,
    organizationName: org.name,
    customers,
    jobs,
    leads,
    invoices,
    bookings,
    files: photos,
    teamMembers,
    hasActivePaidSubscription,
    subscriptionStatus
  };
}

export async function cancelOwnerStripeSubscription(
  admin: SupabaseClient,
  ownerUserId: string
): Promise<{ canceled: boolean; message?: string }> {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    return { canceled: false, message: 'Stripe is not configured.' };
  }

  const { data: subscription } = await admin
    .from('everittos_subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', ownerUserId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionId = subscription?.stripe_subscription_id;
  if (!isValidStripeSubscriptionId(subscriptionId)) {
    return { canceled: true };
  }

  const stripe = new Stripe(stripeKey);
  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to cancel Stripe subscription.';
    return { canceled: false, message };
  }

  await admin
    .from('everittos_subscriptions')
    .update({ status: 'canceled', cancel_at_period_end: false })
    .eq('stripe_subscription_id', subscriptionId);

  await admin
    .from('profiles')
    .update({ subscription_status: 'canceled' })
    .eq('id', ownerUserId);

  return { canceled: true };
}

export async function scheduleWorkspaceDeletion(input: {
  admin: SupabaseClient;
  organizationId: string;
  ownerUserId: string;
  actorEmail: string;
  cancelSubscription?: boolean;
}): Promise<{ ok: true; deletionScheduledAt: string } | { ok: false; error: string }> {
  const { admin, organizationId, ownerUserId, actorEmail, cancelSubscription = true } = input;

  const { data: org } = await admin
    .from('organizations')
    .select('id, name, owner_user_id, deleted_at')
    .eq('id', organizationId)
    .maybeSingle();

  if (!org) return { ok: false, error: 'Workspace not found.' };
  if (org.owner_user_id !== ownerUserId) {
    return { ok: false, error: 'Only the workspace owner can delete this workspace.' };
  }
  if (org.deleted_at) {
    return { ok: false, error: 'This workspace is already scheduled for deletion.' };
  }

  if (cancelSubscription) {
    const stripeResult = await cancelOwnerStripeSubscription(admin, ownerUserId);
    if (!stripeResult.canceled) {
      return {
        ok: false,
        error:
          stripeResult.message ||
          'Cancel the active subscription in billing before deleting this workspace.'
      };
    }

    await admin
      .from('profiles')
      .update({ stripe_customer_id: null })
      .eq('id', ownerUserId);
  }

  const now = new Date();
  const scheduled = deletionScheduledAt(now, WORKSPACE_DELETION_RECOVERY_DAYS);

  const { error } = await admin
    .from('organizations')
    .update({
      deleted_at: now.toISOString(),
      deletion_scheduled_at: scheduled.toISOString()
    })
    .eq('id', organizationId);

  if (error) return { ok: false, error: error.message };

  await admin.from('activity_logs').insert({
    organization_id: organizationId,
    actor_id: ownerUserId,
    actor_name: actorEmail,
    entity_type: 'organization',
    entity_id: organizationId,
    action: 'workspace_soft_deleted',
    message: `Workspace scheduled for deletion after ${WORKSPACE_DELETION_RECOVERY_DAYS}-day recovery window.`
  });

  await logSecurityEvent({
    organizationId,
    userId: ownerUserId,
    eventType: 'account_disabled',
    severity: 'warn',
    message: 'Workspace scheduled for deletion.'
  });

  return { ok: true, deletionScheduledAt: scheduled.toISOString() };
}

export async function restoreWorkspace(
  admin: SupabaseClient,
  organizationId: string,
  ownerUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: org } = await admin
    .from('organizations')
    .select('id, owner_user_id, deleted_at, deletion_scheduled_at')
    .eq('id', organizationId)
    .maybeSingle();

  if (!org) return { ok: false, error: 'Workspace not found.' };
  if (org.owner_user_id !== ownerUserId) {
    return { ok: false, error: 'Only the workspace owner can restore this workspace.' };
  }
  if (!org.deleted_at) {
    return { ok: false, error: 'This workspace is not scheduled for deletion.' };
  }

  const { error } = await admin
    .from('organizations')
    .update({ deleted_at: null, deletion_scheduled_at: null })
    .eq('id', organizationId);

  if (error) return { ok: false, error: error.message };

  await admin.from('activity_logs').insert({
    organization_id: organizationId,
    actor_id: ownerUserId,
    actor_name: 'Workspace owner',
    entity_type: 'organization',
    entity_id: organizationId,
    action: 'workspace_restored',
    message: 'Workspace deletion was canceled and the workspace was restored.'
  });

  return { ok: true };
}

export function getAdminClient() {
  return createAdminSupabase();
}
