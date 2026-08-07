'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { normalizePlan, planDisplayName } from '@/lib/everittos-plans';
import { formatSettingsBillingCopy, getSyncSubscriptionCopy } from '@/lib/i18n/settings-copy';

type SyncSubscriptionButtonProps = {
  onSynced?: (plan: string, status: string) => void;
};

type RefreshResponse = {
  synced?: boolean;
  active?: boolean;
  plan?: string;
  status?: string;
  error?: string;
  message?: string;
  reason?: string;
};

type SyncCurrentUserResponse = {
  updated?: boolean;
  plan?: string;
  status?: string;
  error?: string;
  message?: string;
  reason?: string;
};

export function SyncSubscriptionButton({ onSynced }: SyncSubscriptionButtonProps) {
  const { locale } = useTranslation();
  const c = getSyncSubscriptionCopy(locale);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function syncSubscription() {
    setLoading(true);
    setMessage(c.checking);

    try {
      const sessionId = new URLSearchParams(window.location.search).get('session_id');
      const refreshRes = await fetch('/api/billing/refresh-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ sessionId: sessionId || undefined })
      });
      const refreshJson = (await refreshRes.json().catch(() => ({}))) as RefreshResponse;

      if (refreshRes.ok && refreshJson.synced && refreshJson.plan && refreshJson.status) {
        const nextPlan = normalizePlan(refreshJson.plan);
        const nextStatus = refreshJson.status || `everittos_${nextPlan}`;
        onSynced?.(nextPlan, nextStatus);
        setMessage(formatSettingsBillingCopy(c.synced, { plan: planDisplayName(nextPlan) }));
        return;
      }

      const fallbackRes = await fetch('/api/stripe/sync-current-user', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const fallbackJson = (await fallbackRes.json().catch(() => ({}))) as SyncCurrentUserResponse;

      if (fallbackRes.ok && fallbackJson.updated && fallbackJson.plan && fallbackJson.status) {
        const nextPlan = normalizePlan(fallbackJson.plan);
        const nextStatus = fallbackJson.status || `everittos_${nextPlan}`;
        onSynced?.(nextPlan, nextStatus);
        setMessage(formatSettingsBillingCopy(c.synced, { plan: planDisplayName(nextPlan) }));
        return;
      }

      setMessage(
        refreshJson.error ||
          fallbackJson.error ||
          refreshJson.message ||
          fallbackJson.message ||
          (refreshJson.reason === 'no_stripe_subscription' || fallbackJson.reason === 'no_stripe_subscription'
            ? c.noMapping
            : c.activateFailed)
      );
    } catch {
      setMessage(c.unable);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="billing-sync-subscription">
      <button type="button" className="btn" disabled={loading} onClick={() => void syncSubscription()}>
        {loading ? c.syncing : c.sync}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
