'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';

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
  stripe: {
    configured: boolean;
    webhookConfigured: boolean;
    checkoutConfigured: boolean;
  };
  issues: string[];
  healthy: boolean;
};

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
        setError(json.error || t('billing.health.loadFailed'));
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

  if (loading) {
    return <p className="muted">{t('billing.health.loading')}</p>;
  }

  if (error) {
    return <p className="auth-message auth-message-error">{error}</p>;
  }

  if (!health) return null;

  return (
    <div className="billing-health-check">
      <h3>{t('billing.health.title')}</h3>
      <p className="muted">{t('billing.health.description')}</p>

      <div className="settings-row">
        <span className="settings-row-label">{t('billing.health.profilePlan')}</span>
        <span className="settings-row-value">{health.profile.plan}</span>
      </div>
      <div className="settings-row">
        <span className="settings-row-label">{t('billing.health.subscriptionStatus')}</span>
        <span className="settings-row-value">{health.profile.subscriptionStatus}</span>
      </div>
      <div className="settings-row">
        <span className="settings-row-label">{t('billing.health.stripeCustomerId')}</span>
        <span className="settings-row-value">{health.profile.stripeCustomerId || t('billing.health.missing')}</span>
      </div>
      <div className="settings-row">
        <span className="settings-row-label">{t('billing.health.stripeSubscriptionId')}</span>
        <span className="settings-row-value">
          {health.subscription?.stripeSubscriptionId || t('billing.health.missing')}
        </span>
      </div>
      <div className="settings-row">
        <span className="settings-row-label">{t('billing.health.latestWebhook')}</span>
        <span className="settings-row-value">
          {health.latestWebhookSync
            ? health.latestWebhookSync.success
              ? t('billing.health.webhookSuccess', { event: health.latestWebhookSync.sourceEvent || health.latestWebhookSync.eventType })
              : t('billing.health.webhookFailed', {
                  reason: health.latestWebhookSync.reason || t('billing.health.unknown')
                })
            : t('billing.health.noWebhookYet')}
        </span>
      </div>

      {health.issues.length > 0 ? (
        <ul className="billing-health-issues muted">
          {health.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : (
        <p className="auth-message auth-message-success">{t('billing.health.allGood')}</p>
      )}
    </div>
  );
}
