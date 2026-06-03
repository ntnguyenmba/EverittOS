import type { EverittosPlan } from '@/lib/everittos-plans';
import { planTierRow, type PlanTierId, UNLIMITED_CAP } from '@/lib/plan-config';
import { UNLIMITED } from '@/lib/plan-limit-utils';

export type PlanLimits = {
  jobs: number;
  photos: number;
  customers: number;
  reports: number;
  teamMembers: number;
  crewMembers: number;
  locations: number;
  crewAssignment: boolean;
  teamManagement: boolean;
  scheduling: boolean;
  activityLog: boolean;
  advancedReporting: boolean;
  workflowCustomization: boolean;
  multiLocation: boolean;
  customBranding: boolean;
  pdfReports: boolean;
};

function cap(value: number): number {
  return value === UNLIMITED_CAP ? UNLIMITED : value;
}

export function limitsForPlan(plan: EverittosPlan): PlanLimits {
  const row = planTierRow(plan as PlanTierId);
  return {
    jobs: cap(row.jobs),
    photos: cap(row.photos),
    customers: cap(row.customers),
    reports: cap(row.reports),
    teamMembers: cap(row.teamMembers),
    crewMembers: cap(row.crewMembers),
    locations: cap(row.locations),
    crewAssignment: row.crewAssignment,
    teamManagement: row.teamManagement,
    scheduling: row.scheduling,
    activityLog: row.activityLog,
    advancedReporting: row.advancedReporting,
    workflowCustomization: row.workflowCustomization,
    multiLocation: row.multiLocation,
    customBranding: row.customBranding,
    pdfReports: row.pdfReports
  };
}

export const PLAN_LIMITS: Record<EverittosPlan, PlanLimits> = {
  free: limitsForPlan('free'),
  pro: limitsForPlan('pro'),
  business: limitsForPlan('business'),
  starter: limitsForPlan('starter'),
  growth: limitsForPlan('growth'),
  enterprise: limitsForPlan('enterprise')
};
