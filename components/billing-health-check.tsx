'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import {
  billingHealthSummaryLevel,
  buildBillingHealthStatusCards,
  type BillingHealthStatusCard,
  type BillingHealthStatusLevel
} from '@/lib/billing-health-status';
import { normalizePlan, planDisplayName } from '@/lib/everittos-plans';
import { subscriptionStatusMessage } from '@/lib/stripe-subscription';

type BillingHealthResponse = {
  profile: {
    plan: string;
    subscriptionStatus: string;
    stripeCustomerId: string | null;
  };
  subscription: {
    plan: string;
    status: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    currentPeriodEnd: string | null;
    lastPaymentStatus: string | null;
    updatedAt: string | null;
  } | null;
  latestWebhookSync: {
    eventType: string;
    stripeEventId: string;
    plan: string | null;
    success: boolean;
    reason: string | null;
    sourceEvent: string | null;
    syncedAt: string;
  } | null;
  latestWebhookReceived: {
    eventType: string;
    stripeEventId: string;
    receivedAt: string;
  } | null;
  activationErrors: Array<{
    eventType: string;
    stripeEventId: string;
    plan: string | null;
    reason: string | null;
    at: string;
  }>;
  organization?: {
    organizationId: string | null;
    ownerUserId: string | null;
    effectivePlan: string;
  };
  diagnostics?: {
    environment: {
      stripeSecretKeyConfigured: boolean;
      stripePublishableKeyConfigured: boolean;
      stripeWebhookSecretConfigured: boolean;
    };
    plans: Array<{
      plan: string;
      priceEnvKey: string;
      priceIdConfigured: boolean;
      priceIdPreview: string | null;
      checkoutAvailable: boolean;
    }>;
  };
  latestCheckoutError?: {
    plan: string | null;
    error: string | null;
    code: string | null;
    priceId: string | null;
    at: string;
  } | null;
  stripe: {
    configured: boolean;
    publishableKeyConfigured?: boolean;
    webhookConfigured: boolean;
    checkoutConfigured: boolean;
  };
  issues: string[];
  healthy: boolean;
};

function statusCardClass(level: BillingHealthStatusLevel): string {
  if (level === 'connected') return 'billing-health-status-connected';
  if (level === 'action_required') return 'billing-health-status-action-required';
  return 'billing-health-status-needs-attention';
}

export function BillingHealthCheck() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<BillingHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      const res = await fetch('/api/billing/health', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as BillingHealthResponse & { error?: string };
      if (cancelled) return;

      if (!res.ok) {
        setError(t('billing.health.loadFailed'));
        setHealth(null);
      } else {
        setHealth(json);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const statusCards = useMemo(() => {
    if (!health) return [] as BillingHealthStatusCard[];
    return buildBillingHealthStatusCards({
      profile: health.profile,
      subscription: health.subscription,
      latestWebhookSync: health.latestWebhookSync,
      stripe: health.stripe,
      issues: health.issues
    });
  }, [health]);

  const summaryLevel = useMemo(() => billingHealthSummaryLevel(statusCards), [statusCards]);

  if (loading) {
    return <p className="muted">{t('billing.health.loading')}</p>;
  }

  if (error) {
    return <p className="auth-message auth-message-error">{error}</p>;
  }

  if (!health) return null;

  const plan = normalizePlan(health.profile.plan);

  return (
    <div className="billing-health-check">
      <h3>{t('billing.health.title')}</h3>
      <p className="muted">{t('billing.health.description')}</p>

      <div className={`billing-health-summary ${statusCardClass(summaryLevel)}`}>
        <p className="billing-health-summary-message">{t(`billing.health.summary.${summaryLevel}`)}</p>
        <div className="billing-health-summary-meta">
          <div>
            <span className="billing-health-summary-label">{t('billing.health.currentPlan')}</span>
            <span className="billing-health-summary-value">{planDisplayName(plan)}</span>
          </div>
          <div>
            <span className="billing-health-summary-label">{t('billing.health.accountStatus')}</span>
            <span className="billing-health-summary-value">
              {subscriptionStatusMessage(health.profile.subscriptionStatus)}
            </span>
          </div>
        </div>
      </div>

      <div className="billing-health-status-cards">
        {statusCards.map((card) => (
          <article key={card.key} className={`billing-health-status-card ${statusCardClass(card.level)}`}>
            <span className="billing-health-status-badge">{t(`billing.health.status.${card.level}`)}</span>
            <h4>{t(`billing.health.cards.${card.key}.${card.level}.title`)}</h4>
            <p>{t(`billing.health.cards.${card.key}.${card.level}.description`)}</p>
          </article>
        ))}
      </div>

      <details className="billing-health-technical">
        <summary>{t('billing.health.technicalDetails')}</summary>
        <div className="billing-health-technical-body">
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.health.technical.profilePlan')}</span>
            <span className="settings-row-value">{health.profile.plan}</span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.health.technical.subscriptionStatus')}</span>
            <span className="settings-row-value">{health.profile.subscriptionStatus}</span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.health.technical.stripeCustomerId')}</span>
            <span className="settings-row-value">
              {health.profile.stripeCustomerId || t('billing.health.technical.notSet')}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.health.technical.stripeSubscriptionId')}</span>
            <span className="settings-row-value">
              {health.subscription?.stripeSubscriptionId || t('billing.health.technical.notSet')}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.health.technical.stripePriceId')}</span>
            <span className="settings-row-value">
              {health.subscription?.stripePriceId || t('billing.health.technical.notSet')}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.health.technical.latestWebhook')}</span>
            <span className="settings-row-value">
              {health.latestWebhookSync
                ? health.latestWebhookSync.success
                  ? t('billing.health.technical.webhookSuccess', {
                      event: health.latestWebhookSync.sourceEvent || health.latestWebhookSync.eventType
                    })
                  : t('billing.health.technical.webhookFailed', {
                      reason: health.latestWebhookSync.reason || t('billing.health.technical.unknown')
                    })
                : t('billing.health.technical.noWebhookYet')}
            </span>
          </div>
          {health.latestWebhookReceived ? (
            <div className="settings-row">
              <span className="settings-row-label">Last webhook received</span>
              <span className="settings-row-value">
                {health.latestWebhookReceived.eventType} · {new Date(health.latestWebhookReceived.receivedAt).toLocaleString()}
              </span>
            </div>
          ) : null}
          {health.organization ? (
            <div className="settings-row">
              <span className="settings-row-label">Workspace effective plan</span>
              <span className="settings-row-value">{planDisplayName(normalizePlan(health.organization.effectivePlan))}</span>
            </div>
          ) : null}
          {health.latestCheckoutError ? (
            <div className="settings-row">
              <span className="settings-row-label">Latest checkout error</span>
              <span className="settings-row-value">
                {health.latestCheckoutError.plan || 'unknown'} · {health.latestCheckoutError.error || health.latestCheckoutError.code || 'unknown'}
              </span>
            </div>
          ) : null}
          {health.diagnostics?.plans?.map((row) => (
            <div className="settings-row" key={row.plan}>
              <span className="settings-row-label">{row.plan} price ({row.priceEnvKey})</span>
              <span className="settings-row-value">
                {row.checkoutAvailable
                  ? row.priceIdPreview || 'configured'
                  : 'missing'}
              </span>
            </div>
          ))}
          <div className="settings-row">
            <span className="settings-row-label">Publishable key configured</span>
            <span className="settings-row-value">
              {health.stripe.publishableKeyConfigured ? t('billing.health.technical.yes') : t('billing.health.technical.no')}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.health.technical.stripeConfigured')}</span>
            <span className="settings-row-value">
              {health.stripe.configured ? t('billing.health.technical.yes') : t('billing.health.technical.no')}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.health.technical.webhookConfigured')}</span>
            <span className="settings-row-value">
              {health.stripe.webhookConfigured ? t('billing.health.technical.yes') : t('billing.health.technical.no')}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">{t('billing.health.technical.checkoutConfigured')}</span>
            <span className="settings-row-value">
              {health.stripe.checkoutConfigured ? t('billing.health.technical.yes') : t('billing.health.technical.no')}
            </span>
          </div>
          {health.activationErrors.length > 0 ? (
            <ul className="billing-health-technical-issues">
              {health.activationErrors.map((issue) => (
                <li key={`${issue.stripeEventId}-${issue.at}`}>
                  <code>
                    {issue.eventType}: {issue.reason || 'unknown'}
                  </code>
                </li>
              ))}
            </ul>
          ) : null}
          {health.issues.length > 0 ? (
            <ul className="billing-health-technical-issues">
              {health.issues.map((issue) => (
                <li key={issue}>
                  <code>{issue}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t('billing.health.technical.noIssues')}</p>
          )}
        </div>
      </details>
    </div>
  );
}
