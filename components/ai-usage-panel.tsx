'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { planHasAiAccess, AI_REQUIRED_PLAN } from '@/lib/ai-features';
import { planDisplayName, normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';

type UsagePayload = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  monthlyCap: number;
  monthlyUsed: number;
  remaining: number | null;
  unlimited: boolean;
  periodStart: string;
};

type AiUsagePanelProps = {
  plan: EverittosPlan | string;
};

export function AiUsagePanel({ plan: planProp }: AiUsagePanelProps) {
  const plan = normalizePlan(planProp);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [usage, setUsage] = useState<UsagePayload | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/ai/usage', { cache: 'no-store' });
      const json = await res.json();
      setLoading(false);
      setHasAccess(Boolean(json.hasAccess));
      setUsage(json.usage || null);
    }
    void load();
  }, []);

  if (loading) return <p className="muted">Loading AI usage…</p>;

  if (!planHasAiAccess(plan)) {
    return (
      <div className="ai-usage-panel ai-usage-locked">
        <h3>AI Usage</h3>
        <p className="muted">
          Ask Everitt search is included on every plan. Everitt AI is available on {planDisplayName(AI_REQUIRED_PLAN)} and Enterprise plans.
        </p>
        <Link className="btn btn-primary" href={`/settings/billing?upgrade=${AI_REQUIRED_PLAN}&reason=ai`}>
          Upgrade to unlock AI
        </Link>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="ai-usage-panel">
        <h3>AI Usage</h3>
        <p className="muted">No AI usage recorded this period yet.</p>
      </div>
    );
  }

  const periodLabel = new Date(usage.periodStart).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="ai-usage-panel">
      <h3>AI Usage</h3>
      <p className="muted">Current period: {periodLabel}</p>
      <div className="dashboard-stats-grid" style={{ marginTop: 12 }}>
        <div className="card stat-card">
          <span className="stat-label">Requests</span>
          <strong className="stat-value">{usage.requests}</strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Tokens</span>
          <strong className="stat-value">{usage.totalTokens.toLocaleString()}</strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Est. AI cost</span>
          <strong className="stat-value">${usage.estimatedCostUsd.toFixed(2)}</strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Plan limit</span>
          <strong className="stat-value">
            {usage.unlimited ? 'Unlimited' : `${usage.monthlyUsed} / ${usage.monthlyCap}`}
          </strong>
        </div>
      </div>
      {!usage.unlimited && usage.remaining !== null ? (
        <p className="muted" style={{ marginTop: 10 }}>
          {usage.remaining} AI requests remaining this month.
          {!hasAccess ? ' Update billing if your subscription is inactive.' : ''}
        </p>
      ) : null}
      <p className="muted" style={{ marginTop: 8 }}>
        Input tokens: {usage.promptTokens.toLocaleString()} · Output tokens: {usage.completionTokens.toLocaleString()}
      </p>
    </div>
  );
}
