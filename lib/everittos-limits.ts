import type { EverittosPlan } from '@/lib/everittos-plans';
import { planTierRow, type PlanTierId, UNLIMITED_CAP } from '@/lib/plan-config';
import { UNLIMITED } from '@/lib/plan-limit-utils';

export type PlanLimits = {
  jobs: number;
  photos: number;
  customers: number;
  teamMembers: number;
  crewMembers: number;
  locations: number;
  crewAssignment: boolean;
  teamManagement: boolean;
  scheduling: boolean;
  activityLog: boolean;
  workflowCustomization: boolean;
  multiLocation: boolean;
  customBranding: boolean;
  photoUpload: boolean;
  clientPortal: boolean;
  contractorPortal: boolean;
  beforeAfterPhotos: boolean;
  aiAccess: boolean;
  aiUnlimited: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  bookings: boolean;
  advancedReporting: boolean;
  pdfReports: boolean;
  reports: number;
  brandedReports: boolean;
  catchGrowth: boolean;
};

function cap(value: number): number {
  return value === UNLIMITED_CAP ? UNLIMITED : value;
}

export function limitsForPlan(plan: EverittosPlan): PlanLimits {
  const row = planTierRow(plan as PlanTierId);
  return {
    jobs: cap(row.jobs), photos: cap(row.photos), customers: cap(row.customers), teamMembers: cap(row.teamMembers), crewMembers: cap(row.crewMembers), locations: cap(row.locations),
    crewAssignment: row.crewAssignment, teamManagement: row.teamManagement, scheduling: row.scheduling, activityLog: row.activityLog,
    workflowCustomization: row.workflowCustomization, multiLocation: row.multiLocation, customBranding: row.customBranding, photoUpload: row.photoUpload,
    clientPortal: row.clientPortal, contractorPortal: row.contractorPortal, beforeAfterPhotos: row.beforeAfterPhotos, aiAccess: row.aiAccess,
    aiUnlimited: row.aiUnlimited, apiAccess: row.apiAccess, prioritySupport: row.prioritySupport, bookings: row.bookings,
    advancedReporting: row.advancedReporting, pdfReports: row.pdfReports, reports: cap(row.reports), brandedReports: row.brandedReports,
    catchGrowth: row.catchGrowth
  };
}

export const PLAN_LIMITS: Record<EverittosPlan, PlanLimits> = {
  free: limitsForPlan('free'), pro: limitsForPlan('pro'), business: limitsForPlan('business'), starter: limitsForPlan('starter'), growth: limitsForPlan('growth'), enterprise: limitsForPlan('enterprise')
};
