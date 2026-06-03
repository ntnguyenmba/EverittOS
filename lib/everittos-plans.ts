import type { PlanTierId } from '@/lib/plan-config';
import { limitsForPlan } from '@/lib/everittos-limits';

export type EverittosPlan = PlanTierId;

export const EVERITTOS_STRIPE_LINKS = {
  pro: 'https://buy.stripe.com/eVq7sEcXCbX08Kn8P993y0c',
  business: 'https://buy.stripe.com/fZuaEQ6zegdg2lZe9t93y0b'
} as const;

export type PlanDefinition = {
  id: EverittosPlan;
  name: string;
  priceLabel: string;
  headline: string;
  features: string[];
  buttonLabel: string;
  featured?: boolean;
};

export const EVERITTOS_PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    priceLabel: '$0',
    headline: 'Organize jobs, customers, and field proof.',
    features: ['10 active jobs', '100 photos', '25 customers', '3 reports', '1 user account'],
    buttonLabel: 'Start Free'
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$9/month',
    headline: 'Unlimited jobs, photos, and customers with proof reports.',
    features: ['Unlimited jobs and photos', 'Unlimited customers', 'Up to 25 reports', '1 user account'],
    buttonLabel: 'Start Pro',
    featured: true
  },
  {
    id: 'business',
    name: 'Business',
    priceLabel: '$39/month',
    headline: 'Teams, crew assignment, scheduling, and activity logs.',
    features: ['Everything in Pro', 'Unlimited reports', 'Team members', 'Crew assignment', 'Activity log'],
    buttonLabel: 'Start Business'
  },
  {
    id: 'starter',
    name: 'Starter',
    priceLabel: 'Contact sales',
    headline: 'Small teams with crew and scheduling.',
    features: ['Up to 5 team members', '25 crew workers', '50 reports', 'Activity log'],
    buttonLabel: 'Contact sales'
  },
  {
    id: 'growth',
    name: 'Growth',
    priceLabel: 'Contact sales',
    headline: 'Advanced reporting and workflow customization.',
    features: ['Up to 25 team members', 'Advanced reporting', 'Workflow customization', '3 locations'],
    buttonLabel: 'Contact sales'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Contact sales',
    headline: 'Multi-location, hierarchy, and custom branding.',
    features: ['Unlimited team', 'Multi-location', 'Org hierarchy', 'Custom branding', 'Dedicated onboarding'],
    buttonLabel: 'Contact sales'
  }
];

export function normalizePlan(value: string | null | undefined): EverittosPlan {
  const normalized = (value || 'free').toLowerCase();
  const allowed: EverittosPlan[] = ['free', 'pro', 'business', 'starter', 'growth', 'enterprise'];
  if (allowed.includes(normalized as EverittosPlan)) return normalized as EverittosPlan;
  return 'free';
}

export function isPaidEverittosPlan(plan: EverittosPlan): boolean {
  return plan !== 'free';
}

export function hasTeamManagement(plan: EverittosPlan): boolean {
  return limitsForPlan(plan).teamManagement;
}

export function photoUploadAllowed(_plan: EverittosPlan): boolean {
  return true;
}
