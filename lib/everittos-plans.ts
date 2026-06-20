import type { PlanTierId } from '@/lib/plan-config';
import { normalizePlanId } from '@/lib/plan-config';
import { limitsForPlan } from '@/lib/everittos-limits';

export type EverittosPlan = PlanTierId;

export type PlanDefinition = {
  id: EverittosPlan;
  name: string;
  priceLabel: string;
  headline: string;
  features: string[];
  limits: string[];
  buttonLabel: string;
  featured?: boolean;
};

export const EVERITTOS_PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    priceLabel: '$0',
    headline: 'Track jobs and customers without spreadsheets.',
    features: [
      'Account and login',
      'Dashboard',
      'Customer management',
      'Basic job tracking',
      'Status updates and notes',
      'Schedule and notifications',
      'Basic photo uploads (limited)'
    ],
    limits: ['3 active jobs', '10 customers', '20 photos', '1 user'],
    buttonLabel: 'Start Free'
  },
  {
    id: 'pro',
    name: 'EverittOS Pro',
    priceLabel: '$9/month',
    headline: 'Add before/after photos, reports, and professional job records.',
    features: [
      'Everything in Free',
      'Bookings & appointments',
      'Before and after photos',
      'Job records with notes',
      'Standard reports',
      'Expanded jobs and customers'
    ],
    limits: ['25 active jobs', '100 customers', '100 photos', '3 users'],
    buttonLabel: 'Start Pro',
    featured: true
  },
  {
    id: 'business',
    name: 'EverittOS Business',
    priceLabel: '$39/month',
    headline: 'Add team members, assign jobs, and manage crews.',
    features: [
      'Everything in Pro',
      'Team management',
      'Job assignments',
      'Crew management',
      'Internal notes',
      'Customer history',
      'Activity log',
      'See who is on each job'
    ],
    limits: ['150 active jobs', '1,000 customers', '15 users'],
    buttonLabel: 'Start Business'
  },
  {
    id: 'growth',
    name: 'EverittOS Growth',
    priceLabel: '$399/month',
    headline: 'For larger teams with portals, workflows, and API access.',
    features: [
      'Everything in Business',
      'Workflows',
      'Client and contractor portals',
      'Branded reports',
      'Departments',
      'Dashboard totals by team',
      'API access',
      'Priority support'
    ],
    limits: ['2,500 active jobs', '25,000 customers', '250 users'],
    buttonLabel: 'Start Growth'
  },
  {
    id: 'enterprise',
    name: 'EverittOS Enterprise',
    priceLabel: '$799/month',
    headline: 'For large teams that need custom support and unlimited use.',
    features: [
      'Everything in Growth',
      'Enterprise permissions',
      'Onboarding help from our team',
      'Dedicated support',
      'Role-based access controls',
      'Custom reporting',
      'Unlimited jobs, customers, and users'
    ],
    limits: ['Unlimited jobs', 'Unlimited customers', 'Unlimited users'],
    buttonLabel: 'Start Enterprise'
  }
];

export function normalizePlan(value: string | null | undefined): EverittosPlan {
  return normalizePlanId(value);
}

export function isPaidEverittosPlan(plan: EverittosPlan): boolean {
  return plan !== 'free';
}

export function hasTeamManagement(plan: EverittosPlan): boolean {
  return limitsForPlan(plan).teamManagement;
}

export function photoUploadAllowed(plan: EverittosPlan): boolean {
  return limitsForPlan(plan).photoUpload;
}

export function planDisplayName(plan: EverittosPlan): string {
  return EVERITTOS_PLANS.find((p) => p.id === plan)?.name || 'Free';
}

/** Short plan label for compact nav badges (Pro, Business, Enterprise). */
export function planShortBadgeName(plan: EverittosPlan): string {
  const short: Record<EverittosPlan, string> = {
    free: 'Free',
    pro: 'Pro',
    business: 'Business',
    growth: 'Growth',
    enterprise: 'Enterprise'
  };
  return short[normalizePlan(plan)] || 'Pro';
}

/** Sidebar footer label, e.g. "Free Plan". */
export function planFooterLabel(plan: EverittosPlan): string {
  const name = planShortBadgeName(plan);
  return name === 'Free' ? 'Free Plan' : `${name} Plan`;
}
