import type { EverittosPlan } from '@/lib/everittos-plans';

export type PlanLimits = {
  customers: number;
  jobs: number;
  photos: number;
  crewMembers: number;
  pdfReports: boolean;
  crewAssignment: boolean;
};

export const PLAN_LIMITS: Record<EverittosPlan, PlanLimits> = {
  free: { customers: 25, jobs: 40, photos: 0, crewMembers: 3, pdfReports: false, crewAssignment: false },
  pro: { customers: 250, jobs: 500, photos: 2000, crewMembers: 15, pdfReports: true, crewAssignment: true },
  business: { customers: 2000, jobs: 5000, photos: 20000, crewMembers: 100, pdfReports: true, crewAssignment: true }
};

export function limitsForPlan(plan: EverittosPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}
