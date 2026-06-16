/**
 * Single source of truth for EverittOS plan tiers.
 * DB table `plan_tier_limits` is seeded from these values in migrations.
 */

export type PlanTierId = 'free' | 'pro' | 'business' | 'growth' | 'enterprise';

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
  beforeAfterPhotos: boolean;
  aiAccess: boolean;
  aiUnlimited: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  bookings: boolean;
};

/** -1 = unlimited */
export const UNLIMITED_CAP = -1;

export const PLAN_TIER_ROWS: PlanTierRow[] = [
  {
    id: 'free',
    jobs: 3,
    photos: 20,
    customers: 10,
    reports: 0,
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
    pdfReports: false,
    photoUpload: true,
    clientPortal: false,
    contractorPortal: false,
    brandedReports: false,
    beforeAfterPhotos: false,
    aiAccess: false,
    aiUnlimited: false,
    apiAccess: false,
    prioritySupport: false,
    bookings: false
  },
  {
    id: 'pro',
    jobs: 25,
    photos: 100,
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
    clientPortal: false,
    contractorPortal: false,
    brandedReports: false,
    beforeAfterPhotos: true,
    aiAccess: false,
    aiUnlimited: false,
    apiAccess: false,
    prioritySupport: false,
    bookings: true
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
    beforeAfterPhotos: true,
    aiAccess: true,
    aiUnlimited: false,
    apiAccess: false,
    prioritySupport: false,
    bookings: true
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
    beforeAfterPhotos: true,
    aiAccess: false,
    aiUnlimited: false,
    apiAccess: true,
    prioritySupport: true,
    bookings: true
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
    beforeAfterPhotos: true,
    aiAccess: true,
    aiUnlimited: true,
    apiAccess: true,
    prioritySupport: true,
    bookings: true
  }
];

export function getPlanConfig(plan: PlanTierId): PlanTierRow {
  return planTierRow(plan);
}

export function planTierRow(id: PlanTierId): PlanTierRow {
  const row = PLAN_TIER_ROWS.find((r) => r.id === id);
  if (!row) return PLAN_TIER_ROWS[0];
  return row;
}

/** Legacy aliases */
export function normalizePlanId(value: string | null | undefined): PlanTierId {
  const v = (value || 'free').toLowerCase();
  if (v === 'starter') return 'pro';
  if (v === 'operations') return 'growth';
  const allowed: PlanTierId[] = ['free', 'pro', 'business', 'growth', 'enterprise'];
  if (allowed.includes(v as PlanTierId)) return v as PlanTierId;
  return 'free';
}
