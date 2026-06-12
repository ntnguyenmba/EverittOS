'use client';

import { useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';

type EverittteamUserUsage = {
  userId: string;
  name: string;
  email: string | null;
  prompts: number;
  estimatedCostUsd: number;
};

type EverittteamBudgetPayload = {
  applies: boolean;
  budgetUsd?: number;
  usedUsd?: number;
  remainingUsd?: number;
  percentUsed?: number;
  periodStart?: string;
  byUser?: EverittteamUserUsage[];
  warning?: string | null;
  canReset?: boolean;
};

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function EverittteamAiUsagePanel() {
  const { success, error } = useAppFeedback();
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [data, setData] = useState<EverittteamBudgetPayload | null>(null);

  async function load() {
    const res = await fetch('/api/ai/everittteam-budget', { cache: 'no-store' });
    const json = (await res.json()) as EverittteamBudgetPayload;
    setLoading(false);
    if (!res.ok) {
      setData(null);
      return;
    }
    setData(json);
  }

  useEffect(() => {
    void load();
  }, []);

  async function resetBudget() {
    if (resetting || !data?.canReset) return;
    setResetting(true);
    const res = await fetch('/api/ai/everittteam-budget/reset', { method: 'POST' });
    const json = await res.json();
    setResetting(false);
    if (!res.ok) {
      error(json.error || 'Could not reset AI budget.');
      return;
    }
    success(json.message || 'AI budget reset.');
    void load();
  }

  if (loading) return <p className="muted">Loading AI usage…</p>;
  if (!data?.applies) return null;

  const budgetUsd = data.budgetUsd ?? 0;
  const usedUsd = data.usedUsd ?? 0;
  const remainingUsd = data.remainingUsd ?? 0;
  const percentUsed = data.percentUsed ?? 0;
  const periodLabel = data.periodStart
    ? new Date(data.periodStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'This month';

  return (
    <div className="ai-usage-panel everittteam-ai-usage-panel">
      <div className="everittteam-ai-usage-head">
        <div>
          <h3>AI Usage</h3>
          <p className="muted">Shared EVERITTTEAM budget · {periodLabel}</p>
        </div>
        {data.canReset ? (
          <button type="button" className="btn" disabled={resetting} onClick={() => void resetBudget()}>
            {resetting ? 'Resetting…' : 'Reset budget'}
          </button>
        ) : null}
      </div>

      {data.warning ? <p className="everittteam-ai-warning">{data.warning}</p> : null}

      <div className="everittteam-ai-budget-bar" aria-hidden="true">
        <div className="everittteam-ai-budget-fill" style={{ width: `${Math.min(100, percentUsed)}%` }} />
      </div>

      <div className="dashboard-stats-grid" style={{ marginTop: 12 }}>
        <div className="card stat-card">
          <span className="stat-label">Total budget</span>
          <strong className="stat-value">{formatUsd(budgetUsd)}</strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Used this month</span>
          <strong className="stat-value">{formatUsd(usedUsd)}</strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Remaining</span>
          <strong className="stat-value">{formatUsd(remainingUsd)}</strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Budget used</span>
          <strong className="stat-value">{percentUsed.toFixed(0)}%</strong>
        </div>
      </div>

      <p className="muted everittteam-ai-summary" style={{ marginTop: 12 }}>
        {formatUsd(usedUsd)} / {formatUsd(budgetUsd)} · {formatUsd(remainingUsd)} remaining
      </p>

      {data.byUser && data.byUser.length > 0 ? (
        <div className="everittteam-ai-user-list">
          <p className="everitt-cmd-section-label">Usage by user</p>
          <ul>
            {data.byUser.map((user) => (
              <li key={user.userId} className="everittteam-ai-user-row">
                <div>
                  <strong>{user.name}</strong>
                  <span className="muted">{user.prompts} prompts</span>
                </div>
                <strong>{formatUsd(user.estimatedCostUsd)}</strong>
              </li>
            ))}
          </ul>
          <p className="muted everittteam-ai-total">
            Total · {formatUsd(usedUsd)} / {formatUsd(budgetUsd)}
          </p>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>
          No AI usage recorded this period yet.
        </p>
      )}
    </div>
  );
}
