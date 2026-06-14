'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { STAFF_WORKSPACE_MONTHLY_AI_BUDGET_USD } from '@/lib/ai-usage-events';

type StaffUserRow = {
  userId: string;
  role: string;
  prompts: number;
  costUsd: number;
};

type StaffUsagePayload = {
  staffPromptsToday: number;
  staffBudgetUsedUsd: number;
  staffBudgetCapUsd: number;
  staffLimitsApply?: boolean;
  staffUsersThisMonth: StaffUserRow[];
  searchDoesNotCountAsAi?: boolean;
};

export function StaffAiUsagePanel() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StaffUsagePayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/ai/staff-usage', { cache: 'no-store' });
      if (res.status === 403) {
        setLoading(false);
        return;
      }
      const json = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(json.error || 'Unable to load staff AI usage.');
        return;
      }
      setData(json);
    }
    void load();
  }, []);

  if (loading) return <p className="muted">Loading staff AI usage…</p>;
  if (error) return null;
  if (!data) return null;

  const cap = data.staffBudgetCapUsd ?? STAFF_WORKSPACE_MONTHLY_AI_BUDGET_USD;

  return (
    <div className="ai-usage-panel staff-ai-usage-panel">
      <h3>Staff AI usage</h3>
      <p className="muted">
        Ask Everitt search does not count as paid AI. Staff AI prompts and cost apply only to Everitt AI writing,
        analysis, and generation. Staff usage is tracked separately and does not reduce the workspace owner&apos;s
        plan AI quota.
      </p>
      {data.staffLimitsApply === false ? (
        <p className="muted" style={{ marginTop: 8 }}>
          Staff AI caps are not applied on Enterprise plans.
        </p>
      ) : null}
      <div className="dashboard-stats-grid" style={{ marginTop: 12 }}>
        <div className="card stat-card">
          <span className="stat-label">Staff AI prompts today</span>
          <strong className="stat-value">{data.staffPromptsToday}</strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Staff AI budget this month</span>
          <strong className="stat-value">
            ${data.staffBudgetUsedUsd.toFixed(2)} / ${cap.toFixed(2)}
          </strong>
        </div>
      </div>
      {data.staffUsersThisMonth.length > 0 ? (
        <div className="staff-ai-usage-table" style={{ marginTop: 14 }}>
          <p className="settings-row-label">Staff users this month</p>
          <ul className="staff-ai-usage-list">
            {data.staffUsersThisMonth.map((row) => (
              <li key={row.userId} className="settings-row">
                <span className="settings-row-value">{row.role}</span>
                <span className="muted">
                  {row.prompts} prompt{row.prompts === 1 ? '' : 's'} · ${row.costUsd.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 10 }}>
          No staff AI usage recorded this month.
        </p>
      )}
      <p className="muted" style={{ marginTop: 10 }}>
        Monthly staff AI cap: ${cap.toFixed(2)} per workspace (combined across all staff). Resets on the first of
        each month.
      </p>
    </div>
  );
}
