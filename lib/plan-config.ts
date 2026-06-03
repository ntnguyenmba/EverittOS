/**
 * Single source of truth for EverittOS plan tiers.
 * DB table `plan_tier_limits` is seeded from these values in migration 202605330001.
 */

export type PlanTierId = 'free' | 'pro' | 'business' | 'starter' | 'growth' | 'enterprise';

export type PlanTierRow = {
  id: PlanTierId;
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

/** -1 = unlimited */
export const UNLIMITED_CAP = -1;

export const PLAN_TIER_ROWS: PlanTierRow[] = [
  {
    id: 'free',
    jobs: 10,
    photos: 100,
    customers: 25,
    reports: 3,
    teamMembers: 1,
    crewMembers: 0,
    locations: 1,
    crewAssignment: false,
    teamManagement: false,
    scheduling: true,
    activityLog: false,
    advancedReporting: false,
    workflowCustomization: false,
    multiLocation: false,
    customBranding: false,
    pdfReports: true
  },
  {
    id: 'pro',
    jobs: UNLIMITED_CAP,
    photos: UNLIMITED_CAP,
    customers: UNLIMITED_CAP,
    reports: 25,
    teamMembers: 1,
    crewMembers: 0,
    locations: 1,
    crewAssignment: false,
    teamManagement: false,
    scheduling: true,
    activityLog: false,
    advancedReporting: false,
    workflowCustomization: false,
    multiLocation: false,
    customBranding: false,
    pdfReports: true
  },
  {
    id: 'business',
    jobs: UNLIMITED_CAP,
    photos: UNLIMITED_CAP,
    customers: UNLIMITED_CAP,
    reports: UNLIMITED_CAP,
    teamMembers: UNLIMITED_CAP,
    crewMembers: 100,
    locations: 1,
    crewAssignment: true,
    teamManagement: true,
    scheduling: true,
    activityLog: true,
    advancedReporting: false,
    workflowCustomization: false,
    multiLocation: false,
    customBranding: false,
    pdfReports: true
  },
  {
    id: 'starter',
    jobs: UNLIMITED_CAP,
    photos: UNLIMITED_CAP,
    customers: UNLIMITED_CAP,
    reports: 50,
    teamMembers: 5,
    crewMembers: 25,
    locations: 1,
    crewAssignment: true,
    teamManagement: true,
    scheduling: true,
    activityLog: true,
    advancedReporting: false,
    workflowCustomization: false,
    multiLocation: false,
    customBranding: false,
    pdfReports: true
  },
  {
    id: 'growth',
    jobs: UNLIMITED_CAP,
    photos: UNLIMITED_CAP,
    customers: UNLIMITED_CAP,
    reports: UNLIMITED_CAP,
    teamMembers: 25,
    crewMembers: 100,
    locations: 3,
    crewAssignment: true,
    teamManagement: true,
    scheduling: true,
    activityLog: true,
    advancedReporting: true,
    workflowCustomization: true,
    multiLocation: false,
    customBranding: false,
    pdfReports: true
  },
  {
    id: 'enterprise',
    jobs: UNLIMITED_CAP,
    photos: UNLIMITED_CAP,
    customers: UNLIMITED_CAP,
    reports: UNLIMITED_CAP,
    teamMembers: UNLIMITED_CAP,
    crewMembers: UNLIMITED_CAP,
    locations: UNLIMITED_CAP,
    crewAssignment: true,
    teamManagement: true,
    scheduling: true,
    activityLog: true,
    advancedReporting: true,
    workflowCustomization: true,
    multiLocation: true,
    customBranding: true,
    pdfReports: true
  }
];

export function planTierRow(id: PlanTierId): PlanTierRow {
  const row = PLAN_TIER_ROWS.find((r) => r.id === id);
  if (!row) return PLAN_TIER_ROWS[0];
  return row;
}
