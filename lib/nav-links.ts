import { isFeatureEnabled, type FeatureFlag } from '@/lib/feature-flags';

export type NavLinkDef = {
  label: string;
  href: string;
  flag?: FeatureFlag;
};

export type NavSectionId = 'primary' | 'workspace' | 'business' | 'settings';

export type NavSectionDef = {
  id: NavSectionId;
  showSectionLabel?: boolean;
  items: NavLinkDef[];
};

// Keep the main navigation limited to distinct destinations