'use client';

import Link from 'next/link';
import { EVERITTOS_STRIPE_LINKS, normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import { usageLabels, type UsageCounts } from '@/lib/everittos-usage';
import { limitReached } from '@/lib/plan-limit-utils';

type UsageDashboardProps = {
  plan: EverittosPlan;
  counts: UsageCounts;
};

function upgradeLink(plan: EverittosPlan): string | null {
  if (plan === 'free') return EVERITTOS_STRIPE_LINKS.pro;
  if (plan === 'pro') return EVERITTOS_STRIPE_LINKS.business;
  if (plan === 'business') return EVERITTOS_STRIPE_LINKS.operations;
  if (plan === 'operations') return EVERITTOS_STRIPE_LINKS.growth;
  if (plan === 'growth') return EVERITTOS_STRIPE_LINKS.enterprise;
  return null;
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
    <div className="usage-dashboard">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h3>Plan usage</h3>
          <p className="muted">{planDisplayName(plan)}</p>
        </div>
        {link && (
          <a className="btn btn-primary" href={link} target="_blank" rel="noopener noreferrer">
            Upgrade plan
          </a>
        )}
      </div>
      <div className="stat-grid">
        <div className="stat">
          <strong>{labels.jobs}</strong>
          <p>Active jobs</p>
        </div>
        <div className="stat">
          <strong>{labels.customers}</strong>
          <p>Customers</p>
        </div>
        <div className="stat">
          <strong>{labels.reports}</strong>
          <p>Reports</p>
        </div>
        <div className="stat">
          <strong>{labels.team}</strong>
          <p>Team members</p>
        </div>
        {limits.photoUpload && (
          <div className="stat">
            <strong>{labels.photos}</strong>
            <p>Photos</p>
          </div>
        )}
      </div>
      {nearLimit && link && (
        <div className="card upgrade-banner" style={{ marginTop: 16 }}>
          <p>You are nearing your plan limit. Upgrade for higher limits.</p>
          <Link href="/billing" className="btn">
            View billing
          </Link>
        </div>
      )}
    </div>
  );
}
