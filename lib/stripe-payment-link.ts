import { EVERITTOS_STRIPE_LINKS, type EverittosPlan } from '@/lib/everittos-plans';

export type StripePaymentLinkPlan = Exclude<EverittosPlan, 'free'>;

export type StripePaymentLinkOptions = {
  email?: string | null;
  clientReferenceId?: string | null;
};

export function stripePaymentLinksConfigured(): boolean {
  return Object.values(EVERITTOS_STRIPE_LINKS).every((url) => Boolean(url?.trim()));
}

export function stripePaymentLinkPlans(): StripePaymentLinkPlan[] {
  return Object.keys(EVERITTOS_STRIPE_LINKS) as StripePaymentLinkPlan[];
}

export function resolveStripePaymentLink(plan: StripePaymentLinkPlan): string {
  const url = EVERITTOS_STRIPE_LINKS[plan]?.trim();
  if (!url) {
    throw new Error(`No Stripe payment link for plan: ${plan}`);
  }
  return url;
}

/** Build a Stripe Payment Link URL with supported query parameters. */
export function buildStripePaymentLinkUrl(
  plan: StripePaymentLinkPlan,
  options?: StripePaymentLinkOptions
): string {
  const url = new URL(resolveStripePaymentLink(plan));
  const email = (options?.email || '').trim();
  if (email) {
    url.searchParams.set('prefilled_email', email);
  }
  const ref = (options?.clientReferenceId || '').trim();
  if (ref) {
    url.searchParams.set('client_reference_id', ref);
  }
  return url.toString();
}
