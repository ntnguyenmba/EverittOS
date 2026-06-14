'use client';

import { useEffect, useState } from 'react';
import { STAFF_DAILY_AI_PROMPT_LIMIT, STAFF_MONTHLY_AI_PROMPT_LIMIT } from '@/lib/ai-usage-events';

type StaffUserRow = {
  userId: string;
  role: string;
  prompts: number;
  costUsd: number;
  monthlyPromptCap: number;
};

type StaffUsagePayload = {
  staffPromptsToday: number;
  staffMonthlyPromptCap: number;
  staffDailyPromptCap?: number;
  staffLimitsApply?: boolean;
  workspaceStaffSpendUsd: number;
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

  const dailyCap = data.staffDailyPromptCap ?? STAFF_DAILY_AI_PROMPT_LIMIT;
  const monthlyCap = data.staffMonthlyPromptCap ?? STAFF_MONTHLY_AI_PROMPT_LIMIT;

  return (
    <div className="ai-usage-panel staff-ai-usage-panel">
      <h3>Staff AI usage</h3>
      <p className="muted">
        Ask Everitt search does not count as paid AI. Staff limits are per user — one team member
        cannot use up another&apos;s allowance. Staff usage is tracked separately and does not reduce
        the workspace owner&apos;s plan AI quota.
      </p>
      {data.staffLimitsApply === false ? (
        <p className="muted" style={{ marginTop: 8 }}>
          Staff AI caps are not applied on Enterprise plans.
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 8 }}>
          Each staff member: {dailyCap} AI prompts per day, {monthlyCap} per month.
        </p>
      )}
      <div className="dashboard-stats-grid" style={{ marginTop: 12 }}>
        <div className="card stat-card">
          <span className="stat-label">Staff AI prompts today (all staff)</span>
          <strong className="stat-value">{data.staffPromptsToday}</strong>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Estimated staff AI cost this month</span>
          <strong className="stat-value">${data.workspaceStaffSpendUsd.toFixed(2)}</strong>
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
                  {row.prompts} / {row.monthlyPromptCap || monthlyCap} prompts · ${row.costUsd.toFixed(2)}
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
    </div>
  );
}
