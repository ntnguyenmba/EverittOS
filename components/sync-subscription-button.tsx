'use client';

import { useState } from 'react';
import { normalizePlan, planDisplayName } from '@/lib/everittos-plans';

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
};

type SyncCurrentUserResponse = {
  updated?: boolean;
  plan?: string;
  status?: string;
  error?: string;
  message?: string;
};

export function SyncSubscriptionButton({ onSynced }: SyncSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function syncSubscription() {
    setLoading(true);
    setMessage('Checking Stripe for your active subscription...');

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
        setMessage(`Subscription synced. Your plan is now ${planDisplayName(nextPlan)}.`);
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
        setMessage(`Subscription synced. Your plan is now ${planDisplayName(nextPlan)}.`);
        return;
      }

      setMessage(
        refreshJson.message ||
          fallbackJson.message ||
          refreshJson.error ||
          fallbackJson.error ||
          'Payment was received, but the subscription is still syncing. Try again in a moment.'
      );
    } catch {
      setMessage('Unable to sync subscription right now. Please try again in a minute.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="billing-sync-subscription">
      <button type="button" className="btn" disabled={loading} onClick={() => void syncSubscription()}>
        {loading ? 'Syncing...' : 'Sync subscription'}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
