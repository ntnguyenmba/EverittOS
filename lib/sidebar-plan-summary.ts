import { planShortBadgeName, type EverittosPlan } from '@/lib/everittos-plans';
import { usageLabels, type UsageCounts } from '@/lib/everittos-usage';

/** Compact usage line for the sidebar plan card. */
export function sidebarPlanUsageSummary(plan: EverittosPlan, counts: UsageCounts): string {
  const labels = usageLabels(plan, counts);
  return `${labels.jobs} jobs · ${labels.customers} customers`;
}

export function sidebarPlanDisplayName(plan: EverittosPlan): string {
  return planShortBadgeName(plan);
}
