'use client';

import { useState } from 'react';
import { normalizePlan, planDisplayName } from '@/lib/everittos-plans';

type SyncSubscriptionButtonProps = {
  onSynced?: (plan: string, status: string) => void;
};

type SyncResponse = {
  active?: boolean;
  synced?: boolean;
  updated?: boolean;
  plan?: string;
  status?: string;
  message?: string;
  error?: string;
};

export function SyncSubscriptionButton({ onSynced }: SyncSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function readJson(res: Response): Promise<SyncResponse> {
    return res.json().catch(() => ({}));
  }

  async function syncSubscription() {
    setLoading(true);
    setMessage('Checking Stripe for your active subscription...');

    try {
      let res = await fetch('/api/billing/refresh-subscription', { method: 'POST' });
      let json = await readJson(res);

      if (!res.ok || (!json.synced && !json.active)) {
        res = await fetch('/api/stripe/sync-current-user', { method: 'POST' });
        json = await readJson(res);
      }

      if (!res.ok || (!json.synced && !json.updated && !json.active)) {
        setMessage(json.message || json.error || 'Payment was received, but the subscription is still syncing. Try again in a moment.');
        return;
      }

      const nextPlan = normalizePlan(json.plan);
      const nextStatus = json.status || `everittos_${nextPlan}`;
      onSynced?.(nextPlan, nextStatus);
      setMessage(`Subscription synced. Your plan is now ${planDisplayName(nextPlan)}.`);
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
