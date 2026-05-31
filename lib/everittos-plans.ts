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
    headline: 'Organize jobs, customers, and crew in one place.',
    features: ['Account and dashboard', 'Job and customer records', 'Status updates and basic notes'],
    buttonLabel: 'Start Free'
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$9/month',
    headline: 'Photo proof, crew assignment, and printable reports.',
    features: ['Everything in Free', 'Before/after photos', 'One crew', 'Professional reports'],
    buttonLabel: 'Start Pro',
    featured: true
  },
  {
    id: 'business',
    name: 'Business',
    priceLabel: '$39/month',
    headline: 'Multiple crews and locations with grouped dashboards.',
    features: ['Everything in Pro', 'Multiple crews', 'Location filters', 'Dashboard by crew or site'],
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

export function photoUploadAllowed(plan: EverittosPlan): boolean {
  return isPaidEverittosPlan(plan);
}
