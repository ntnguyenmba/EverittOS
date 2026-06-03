import type { EverittosPlan } from '@/lib/everittos-plans';
import { UNLIMITED } from '@/lib/plan-limit-utils';

export type PlanLimits = {
  jobs: number;
  photos: number;
  customers: number;
  reports: number;
  teamMembers: number;
  crewMembers: number;
  crewAssignment: boolean;
  pdfReports: boolean;
};

export const PLAN_LIMITS: Record<EverittosPlan, PlanLimits> = {
  free: {
    jobs: 10,
    photos: 100,
    customers: 25,
    reports: 3,
    teamMembers: 1,
    crewMembers: 0,
    crewAssignment: false,
    pdfReports: true
  },
  pro: {
    jobs: UNLIMITED,
    photos: UNLIMITED,
    customers: UNLIMITED,
    reports: 25,
    teamMembers: 1,
    crewMembers: 0,
    crewAssignment: false,
    pdfReports: true
  },
  business: {
    jobs: UNLIMITED,
    photos: UNLIMITED,
    customers: UNLIMITED,
    reports: UNLIMITED,
    teamMembers: UNLIMITED,
    crewMembers: 100,
    crewAssignment: true,
    pdfReports: true
  }
};

export function limitsForPlan(plan: EverittosPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}
