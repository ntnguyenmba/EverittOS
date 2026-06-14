/**
 * Feature flags for modules not yet in primary navigation.
 * Routes may still exist for direct access when enabled.
 */
export const FEATURE_FLAGS = {
  projectsNav: false,
  knowledgeNav: false,
  automationsNav: false,
  clientsNavPage: false,
  formsNav: true,
  templatesNav: true,
  reviewsNav: true,
  estimatesNav: true,
  invoicesNav: true,
  messagesNav: true,
  proposalsNav: true,
  leadsNav: true,
  servicesNav: true,
  bookingsNav: true,
  globalSearch: true,
  multiOrgSwitcher: true,
  aiActions: true
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
