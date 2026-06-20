'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { sidebarPlanDisplayName, sidebarPlanUsageSummary } from '@/lib/sidebar-plan-summary';
import { fetchUsageCounts } from '@/lib/everittos-usage';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { supabase } from '@/lib/supabase';

type SidebarPlanCardProps = {
  plan: EverittosPlan | string | null;
  showBillingLink?: boolean;
  showUpgrade?: boolean;
  showViewPlans?: boolean;
  billingActive?: boolean;
  onNavigate?: () => void;
};

export function SidebarPlanCard({
  plan,
  showBillingLink = false,
  showUpgrade = false,
  showViewPlans = false,
  billingActive = false,
  onNavigate
}: SidebarPlanCardProps) {
  const { t } = useTranslation();
  const normalized = plan != null ? normalizePlan(plan) : null;
  const [usageSummary, setUsageSummary] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsage() {
      if (!normalized) return;
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const org = await ensureOrganizationForUser(user.id);
      const counts = await fetchUsageCounts(user.id, org?.organizationId);
      if (!cancelled) {
        setUsageSummary(sidebarPlanUsageSummary(normalized, counts));
      }
    }

    void loadUsage();
    return () => {
      cancelled = true;
    };
  }, [normalized]);

  const planName = normalized ? sidebarPlanDisplayName(normalized) : '…';

  return (
    <div className="sidebar-plan-card">
      <div className="sidebar-plan-card-head">
        <div>
          <p className="sidebar-plan-card-label">{t('billing.currentPlan')}</p>
          {showBillingLink ? (
            <Link
              href="/settings/billing"
              className={`sidebar-plan-card-name${billingActive ? ' active' : ''}`}
              onClick={onNavigate}
            >
              {planName}
            </Link>
          ) : (
            <p className="sidebar-plan-card-name">{planName}</p>
          )}
        </div>
      </div>

      {usageSummary ? <p className="sidebar-plan-card-usage">{usageSummary}</p> : null}

      {showUpgrade ? (
        <Link href="/settings/billing" className="sidebar-plan-card-upgrade" onClick={onNavigate}>
          {t('billing.upgrade')}
        </Link>
      ) : null}

      {showViewPlans ? (
        <Link href="/settings/billing" className="sidebar-plan-card-view-plans" onClick={onNavigate}>
          View plans
        </Link>
      ) : null}
    </div>
  );
}
