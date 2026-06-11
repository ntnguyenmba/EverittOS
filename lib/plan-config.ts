/**
 * Single source of truth for EverittOS plan tiers.
 * DB table `plan_tier_limits` is seeded from these values in migrations.
 */

export type PlanTierId = 'free' | 'pro' | 'business' | 'operations' | 'growth' | 'enterprise';

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
  photoUpload: boolean;
  clientPortal: boolean;
  contractorPortal: boolean;
  brandedReports: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
};

/** -1 = unlimited */
export const UNLIMITED_CAP = -1;

export const PLAN_TIER_ROWS: PlanTierRow[] = [
  {
    id: 'free',
    jobs: 3,
    photos: 20,
    customers: 10,
    reports: 10,
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
    pdfReports: true,
    photoUpload: true,
    clientPortal: false,
    contractorPortal: false,
    brandedReports: false,
    apiAccess: false,
    prioritySupport: false
  },
  {
    id: 'pro',
    jobs: 25,
    photos: UNLIMITED_CAP,
    customers: 100,
    reports: UNLIMITED_CAP,
    teamMembers: 3,
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
    pdfReports: true,
    photoUpload: true,
    clientPortal: true,
    contractorPortal: false,
    brandedReports: false,
    apiAccess: false,
    prioritySupport: false
  },
  {
    id: 'business',
    jobs: 150,
    photos: UNLIMITED_CAP,
    customers: 1000,
    reports: UNLIMITED_CAP,
    teamMembers: 15,
    crewMembers: 100,
    locations: 1,
    crewAssignment: true,
    teamManagement: true,
    scheduling: true,
    activityLog: true,
    advancedReporting: true,
    workflowCustomization: false,
    multiLocation: false,
    customBranding: false,
    pdfReports: true,
    photoUpload: true,
    clientPortal: false,
    contractorPortal: false,
    brandedReports: false,
    apiAccess: false,
    prioritySupport: false
  },
  {
    id: 'operations',
    jobs: 500,
    photos: UNLIMITED_CAP,
    customers: 5000,
    reports: UNLIMITED_CAP,
    teamMembers: 50,
    crewMembers: 200,
    locations: 5,
    crewAssignment: true,
    teamManagement: true,
    scheduling: true,
    activityLog: true,
    advancedReporting: true,
    workflowCustomization: false,
    multiLocation: false,
    customBranding: true,
    pdfReports: true,
    photoUpload: true,
    clientPortal: true,
    contractorPortal: true,
    brandedReports: true,
    apiAccess: false,
    prioritySupport: true
  },
  {
    id: 'growth',
    jobs: 2500,
    photos: UNLIMITED_CAP,
    customers: 25000,
    reports: UNLIMITED_CAP,
    teamMembers: 250,
    crewMembers: UNLIMITED_CAP,
    locations: 25,
    crewAssignment: true,
    teamManagement: true,
    scheduling: true,
    activityLog: true,
    advancedReporting: true,
    workflowCustomization: true,
    multiLocation: true,
    customBranding: true,
    pdfReports: true,
    photoUpload: true,
    clientPortal: true,
    contractorPortal: true,
    brandedReports: true,
    apiAccess: true,
    prioritySupport: true
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
    pdfReports: true,
    photoUpload: true,
    clientPortal: true,
    contractorPortal: true,
    brandedReports: true,
    apiAccess: true,
    prioritySupport: true
  }
];

export function planTierRow(id: PlanTierId): PlanTierRow {
  const row = PLAN_TIER_ROWS.find((r) => r.id === id);
  if (!row) return PLAN_TIER_ROWS[0];
  return row;
}

/** Legacy alias */
export function normalizePlanId(value: string | null | undefined): PlanTierId {
  const v = (value || 'free').toLowerCase();
  if (v === 'starter') return 'operations';
  const allowed: PlanTierId[] = ['free', 'pro', 'business', 'operations', 'growth', 'enterprise'];
  if (allowed.includes(v as PlanTierId)) return v as PlanTierId;
  return 'free';
}
