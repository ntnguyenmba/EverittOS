'use client';

import { useState } from 'react';
import { normalizePlan, planDisplayName } from '@/lib/everittos-plans';

type SyncSubscriptionButtonProps = {
  onSynced?: (plan: string, status: string) => void;
};

export function SyncSubscriptionButton({ onSynced }: SyncSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function syncSubscription() {
    setLoading(true);
    setMessage('Checking Stripe for your active subscription...');

    try {
      const res = await fetch('/api/stripe/sync-current-user', { method: 'POST' });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.updated) {
        setMessage(json.message || json.error || 'No active Stripe subscription was found for your EverittOS login email.');
        return;
      }

      const nextPlan = normalizePlan(json.plan);
      const nextStatus = json.status || `everittos_${nextPlan}`;
      onSynced?.(nextPlan, nextStatus);
      setMessage(`Subscription synced. Your plan is now ${planDisplayName(nextPlan)}.`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      setMessage('Unable to sync subscription right now. Please try again in a minute.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="billing-sync-subscription">
      <button type="button" className="btn" disabled={loading} onClick={syncSubscription}>
        {loading ? 'Syncing...' : 'Sync subscription'}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
