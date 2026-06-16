export type BillingHealthStatusLevel = 'connected' | 'needs_attention' | 'action_required';

export type BillingHealthStatusCardKey =
  | 'stripeAccount'
  | 'subscriptionInfo'
  | 'billingConfiguration'
  | 'subscriptionSync'
  | 'billingService';

export type BillingHealthStatusCard = {
  key: BillingHealthStatusCardKey;
  level: BillingHealthStatusLevel;
};

export type BillingHealthStatusInput = {
  profile: {
    plan: string;
    stripeCustomerId: string | null;
  };
  subscription: {
    stripeSubscriptionId: string | null;
  } | null;
  latestWebhookSync: {
    success: boolean;
  } | null;
  stripe: {
    configured: boolean;
    webhookConfigured: boolean;
    checkoutConfigured: boolean;
  };
  issues: string[];
};

function hasWebhookSyncFailure(issues: string[]): boolean {
  return issues.some((issue) => issue.startsWith('webhook_sync_failed:'));
}

export function buildBillingHealthStatusCards(input: BillingHealthStatusInput): BillingHealthStatusCard[] {
  const { issues, profile, subscription, latestWebhookSync, stripe } = input;
  const cards: BillingHealthStatusCard[] = [];
  const paidPlan = profile.plan !== 'free';

  if (!stripe.configured || !stripe.webhookConfigured) {
    cards.push({ key: 'billingService', level: 'action_required' });
  } else {
    cards.push({ key: 'billingService', level: 'connected' });
  }

  cards.push({
    key: 'stripeAccount',
    level: profile.stripeCustomerId ? 'connected' : 'needs_attention'
  });

  if (!paidPlan || subscription?.stripeSubscriptionId) {
    cards.push({ key: 'subscriptionInfo', level: 'connected' });
  } else {
    cards.push({ key: 'subscriptionInfo', level: 'needs_attention' });
  }

  cards.push({
    key: 'billingConfiguration',
    level: stripe.checkoutConfigured ? 'connected' : 'needs_attention'
  });

  if (hasWebhookSyncFailure(issues)) {
    cards.push({ key: 'subscriptionSync', level: 'action_required' });
  } else if (latestWebhookSync?.success) {
    cards.push({ key: 'subscriptionSync', level: 'connected' });
  } else {
    cards.push({ key: 'subscriptionSync', level: 'needs_attention' });
  }

  return cards;
}

export function billingHealthSummaryLevel(cards: BillingHealthStatusCard[]): BillingHealthStatusLevel {
  if (cards.some((card) => card.level === 'action_required')) return 'action_required';
  if (cards.some((card) => card.level === 'needs_attention')) return 'needs_attention';
  return 'connected';
}

export function isInternalBillingIssueCode(value: string): boolean {
  return (
    value.startsWith('missing_stripe_') ||
    value.startsWith('webhook_sync_failed:') ||
    /^[A-Z][A-Z0-9_]+$/.test(value)
  );
}
