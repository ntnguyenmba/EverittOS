import type { createAdminSupabase } from '@/lib/supabase-admin';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { logBillingPipeline } from '@/lib/billing-pipeline-log';
import { logStripeBilling } from '@/lib/stripe-billing-logs';

type AdminClient = NonNullable<ReturnType<typeof createAdminSupabase>>;

export type BillingWriteResult = {
  table: string;
  operation: 'update' | 'upsert';
  target: string;
  ok: boolean;
  rowsAffected: number;
  error?: string;
  fields: string[];
};

export type BillingActivationWrites = {
  ok: boolean;
  writes: BillingWriteResult[];
  error?: string;
};

export function summarizeWrites(writes: BillingWriteResult[]): BillingActivationWrites {
  const failed = writes.filter((write) => !write.ok);
  if (failed.length > 0) {
    const details = failed
      .map((write) => `${write.table}:${write.target}:${write.error || 'write failed'}`)
      .join('; ');
    throw new Error(`Billing activation failed: ${details}`);
  }

  return {
    ok: true,
    writes
  };
}

async function countUpdatedRows<T extends Record<string, unknown>>(
  data: T[] | null,
  error: { message: string } | null
): Promise<{ rowsAffected: number; error?: string }> {
  if (error) return { rowsAffected: 0, error: error.message };
  return { rowsAffected: data?.length ?? 0 };
}

export async function writeBillingProfile(
  admin: AdminClient,
  input: {
    profileId: string;
    update: Record<string, unknown>;
    context: Record<string, unknown>;
  }
): Promise<BillingWriteResult> {
  const fields = Object.keys(input.update);
  const { data, error } = await admin
    .from('profiles')
    .update(input.update)
    .eq('id', input.profileId)
    .select('id');

  const counted = await countUpdatedRows(data, error);
  const result: BillingWriteResult = {
    table: 'profiles',
    operation: 'update',
    target: input.profileId,
    fields,
    ok: !error && counted.rowsAffected === 1,
    rowsAffected: counted.rowsAffected,
    error: counted.error || (counted.rowsAffected === 0 ? 'No profile row updated' : undefined)
  };

  if (result.ok) {
    logBillingPipeline('profile_updated', {
      profileId: input.profileId,
      rowsAffected: result.rowsAffected,
      fields,
      ...input.context
    });
  } else {
    logBillingPipeline('activation_failed', {
      stage: 'profile_updated',
      profileId: input.profileId,
      rowsAffected: result.rowsAffected,
      error: result.error,
      fields,
      ...input.context
    });
    logStripeBilling('sync:issue', { issue: 'profile_update_failed', userId: input.profileId, rowsAffected: result.rowsAffected, error: result.error, fields }, 'warn');
  }

  return result;
}

export async function writeBillingOrganizationPlan(
  admin: AdminClient,
  input: {
    organizationId: string;
    plan: EverittosPlan;
    context: Record<string, unknown>;
  }
): Promise<BillingWriteResult> {
  const { data, error } = await admin
    .from('organizations')
    .update({ plan: input.plan })
    .eq('id', input.organizationId)
    .select('id');

  const counted = await countUpdatedRows(data, error);
  let result: BillingWriteResult = {
    table: 'organizations',
    operation: 'update',
    target: input.organizationId,
    fields: ['plan'],
    ok: !error && counted.rowsAffected === 1,
    rowsAffected: counted.rowsAffected,
    error: counted.error || (counted.rowsAffected === 0 ? 'No organization row updated' : undefined)
  };

  if (result.ok) {
    const now = new Date().toISOString();
    const { data: entitlementRows, error: entitlementError } = await admin
      .from('account_entitlements')
      .upsert(
        {
          organization_id: input.organizationId,
          plan: input.plan,
          source: 'stripe',
          status: 'active',
          expires_at: null,
          billing_subscription_id: null,
          last_resolved_at: now,
          updated_at: now
        },
        { onConflict: 'organization_id' }
      )
      .select('id');

    if (entitlementError || !entitlementRows || entitlementRows.length !== 1) {
      result = {
        ...result,
        ok: false,
        error: entitlementError?.message || 'Shared entitlement row was not saved'
      };
    }
  }

  if (result.ok) {
    logBillingPipeline('workspace_updated', {
      organizationId: input.organizationId,
      plan: input.plan,
      rowsAffected: result.rowsAffected,
      entitlementSource: 'stripe',
      ...input.context
    });
  } else {
    logBillingPipeline('activation_failed', {
      stage: 'workspace_updated',
      organizationId: input.organizationId,
      plan: input.plan,
      rowsAffected: result.rowsAffected,
      error: result.error,
      ...input.context
    });
    logStripeBilling('sync:issue', { issue: 'organization_plan_update_failed', workspaceId: input.organizationId, plan: input.plan, rowsAffected: result.rowsAffected, error: result.error }, 'warn');
  }

  return result;
}

export async function writeBillingSubscriptionRow(
  admin: AdminClient,
  input: {
    row: Record<string, unknown>;
    conflictTarget: 'stripe_subscription_id' | 'stripe_session_id';
    context: Record<string, unknown>;
  }
): Promise<BillingWriteResult> {
  const { data, error } = await admin
    .from('everittos_subscriptions')
    .upsert(input.row, { onConflict: input.conflictTarget })
    .select('id');

  const counted = await countUpdatedRows(data, error);
  const target =
    (typeof input.row.stripe_subscription_id === 'string' && input.row.stripe_subscription_id) ||
    (typeof input.row.stripe_session_id === 'string' && input.row.stripe_session_id) ||
    String(input.row.user_id || 'unknown');

  const result: BillingWriteResult = {
    table: 'everittos_subscriptions',
    operation: 'upsert',
    target,
    fields: [
      'user_id',
      'email',
      'plan',
      'status',
      'stripe_customer_id',
      'stripe_subscription_id',
      'stripe_price_id',
      'organization_id'
    ],
    ok: !error && counted.rowsAffected >= 1,
    rowsAffected: counted.rowsAffected,
    error: counted.error || (counted.rowsAffected === 0 ? 'No subscription row upserted' : undefined)
  };

  if (result.ok) {
    logBillingPipeline('subscription_saved', {
      rowsAffected: result.rowsAffected,
      conflictTarget: input.conflictTarget,
      plan: input.row.plan,
      status: input.row.status,
      stripeSubscriptionId: input.row.stripe_subscription_id,
      stripeCustomerId: input.row.stripe_customer_id,
      ...input.context
    });
  } else {
    logBillingPipeline('activation_failed', {
      stage: 'subscription_saved',
      rowsAffected: result.rowsAffected,
      conflictTarget: input.conflictTarget,
      error: result.error,
      ...input.context
    });
    logStripeBilling('sync:issue', { issue: 'subscription_upsert_failed', rowsAffected: result.rowsAffected, conflictTarget: input.conflictTarget, error: result.error }, 'warn');
  }

  return result;
}
