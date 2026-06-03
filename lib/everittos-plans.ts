export type EverittosPlan = 'free' | 'pro' | 'business';

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
    headline: 'Teams, crew assignment, and unlimited reports.',
    features: ['Everything in Pro', 'Unlimited reports', 'Multiple users', 'Crew assignment'],
    buttonLabel: 'Start Business'
  }
];

export function normalizePlan(value: string | null | undefined): EverittosPlan {
  const normalized = (value || 'free').toLowerCase();
  if (normalized === 'pro' || normalized === 'business') return normalized;
  return 'free';
}

export function isPaidEverittosPlan(plan: EverittosPlan): boolean {
  return plan === 'pro' || plan === 'business';
}

export function photoUploadAllowed(_plan: EverittosPlan): boolean {
  return true;
}
