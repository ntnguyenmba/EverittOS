'use client';

import type { EverittosPlan } from '@/lib/everittos-plans';
import { usageLabels, type UsageCounts } from '@/lib/everittos-usage';

type UsageStatsProps = {
  plan: EverittosPlan;
  counts: UsageCounts;
};

export function UsageStats({ plan, counts }: UsageStatsProps) {
  const labels = usageLabels(plan, counts);

  return (
    <div className="stat-grid">
      <div className="stat">
        <strong>{labels.jobs}</strong>
        <p>Jobs</p>
      </div>
      <div className="stat">
        <strong>{labels.photos}</strong>
        <p>Photos</p>
      </div>
      <div className="stat">
        <strong>{labels.customers}</strong>
        <p>Customers</p>
      </div>
      <div className="stat">
        <strong>{labels.reports}</strong>
        <p>Reports</p>
      </div>
    </div>
  );
}
