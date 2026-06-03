import type { PlanTierId } from '@/lib/plan-config';
import { normalizePlanId } from '@/lib/plan-config';
import { limitsForPlan } from '@/lib/everittos-limits';

export type EverittosPlan = PlanTierId;

export const EVERITTOS_STRIPE_LINKS = {
  pro: 'https://buy.stripe.com/eVq7sEcXCbX08Kn8P993y0c',
  business: 'https://buy.stripe.com/fZuaEQ6zegdg2lZe9t93y0b',
  operations: 'https://buy.stripe.com/cNi4gs8Hm3qu8Kn7L593y08',
  growth: 'https://buy.stripe.com/9B6aEQcXCbX06Cf7L593y09',
  enterprise: 'https://buy.stripe.com/3cI6oA5va6CG5yb5CX93y0a'
} as const;

export type PlanDefinition = {
  id: EverittosPlan;
  name: string;
  priceLabel: string;
  headline: string;
  features: string[];
  limits: string[];
  buttonLabel: string;
  featured?: boolean;
  stripeLink?: string;
};

export const EVERITTOS_PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    priceLabel: '$0',
    headline: 'Get organized and stop losing track of work.',
    features: [
      'Account and login',
      'Dashboard',
      'Customer management',
      'Basic job tracking',
      'Status updates and notes',
      'Basic reports'
    ],
    limits: ['3 active jobs', '10 customers', '1 user'],
    buttonLabel: 'Start Free'
  },
  {
    id: 'pro',
    name: 'EverittOS Pro',
    priceLabel: '$9/month',
    headline: 'Run a more professional operation.',
    features: [
      'Everything in Free',
      'Before and after photos',
      'Professional job records',
      'Standard reports',
      'Expanded customer and job management'
    ],
    limits: ['25 active jobs', '100 customers', '3 users'],
    buttonLabel: 'Start Pro',
    featured: true,
    stripeLink: EVERITTOS_STRIPE_LINKS.pro
  },
  {
    id: 'business',
    name: 'EverittOS Business',
    priceLabel: '$39/month',
    headline: 'Scale without losing control.',
    features: [
      'Everything in Pro',
      'Team management',
      'Job assignments',
      'Crew management',
      'Internal notes',
      'Customer history',
      'Advanced reporting',
      'Workforce visibility'
    ],
    limits: ['150 active jobs', '1,000 customers', '15 users'],
    buttonLabel: 'Start Business',
    stripeLink: EVERITTOS_STRIPE_LINKS.business
  },
  {
    id: 'operations',
    name: 'EverittOS Operations',
    priceLabel: '$149/month',
    headline: 'Coordinate contractors, clients, and field teams.',
    features: [
      'Everything in Business',
      'Contractor portal',
      'Client portal',
      'Role-based permissions',
      'Workforce activity tracking',
      'Branded reports',
      'Priority support'
    ],
    limits: ['500 active jobs', '5,000 customers', '50 users'],
    buttonLabel: 'Start Operations',
    stripeLink: EVERITTOS_STRIPE_LINKS.operations
  },
  {
    id: 'growth',
    name: 'EverittOS Growth',
    priceLabel: '$399/month',
    headline: 'Operate at scale with deeper visibility.',
    features: [
      'Everything in Operations',
      'Advanced workforce management',
      'Department-level visibility',
      'Operational dashboards',
      'API access',
      'Custom workflows',
      'Advanced reporting'
    ],
    limits: ['2,500 active jobs', '25,000 customers', '250 users'],
    buttonLabel: 'Start Growth',
    stripeLink: EVERITTOS_STRIPE_LINKS.growth
  },
  {
    id: 'enterprise',
    name: 'EverittOS Enterprise',
    priceLabel: '$799/month',
    headline: 'High-touch operations for strategic accounts.',
    features: [
      'Everything in Growth',
      'Enterprise permissions',
      'Dedicated onboarding',
      'Dedicated support',
      'Advanced security controls',
      'Custom reporting',
      'Unlimited jobs, customers, and users'
    ],
    limits: ['Unlimited jobs', 'Unlimited customers', 'Unlimited users'],
    buttonLabel: 'Start Enterprise',
    stripeLink: EVERITTOS_STRIPE_LINKS.enterprise
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
