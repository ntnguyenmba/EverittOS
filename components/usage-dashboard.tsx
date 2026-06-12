'use client';

import Link from 'next/link';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import { usageLabels, type UsageCounts } from '@/lib/everittos-usage';
import { limitReached } from '@/lib/plan-limit-utils';

type UsageDashboardProps = {
  plan: EverittosPlan;
  counts: UsageCounts;
};

function upgradeLink(plan: EverittosPlan): string | null {
  if (plan === 'enterprise') return null;
  return '/settings/billing';
}

export function UsageDashboard({ plan, counts }: UsageDashboardProps) {
  const labels = usageLabels(plan, counts);
  const limits = limitsForPlan(plan);
  const link = upgradeLink(plan);

  const nearLimit =
    limitReached(limits.jobs, counts.jobs - 1) ||
    limitReached(limits.customers, counts.customers - 1) ||
    limitReached(limits.teamMembers, counts.teamMembers - 1);

  return (
    <div className="usage-dashboard usage-dashboard-compact">
      <div className="usage-dashboard-head">
        <p className="muted">{planDisplayName(plan)}</p>
        {link ? (
          <Link className="btn btn-sm" href={link}>
            View plans
          </Link>
        ) : null}
      </div>
      <div className="usage-dashboard-stats">
        <span>{labels.jobs} jobs</span>
        <span>{labels.customers} customers</span>
        <span>{labels.team} team</span>
        {limits.photoUpload ? <span>{labels.photos} photos</span> : null}
      </div>
      {nearLimit && (
        <p className="usage-dashboard-note">
          Near plan limit. <Link href="/settings/billing">View plans</Link>
        </p>
      )}
    </div>
  );
}
