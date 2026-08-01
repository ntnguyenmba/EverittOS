import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerSupabase } from '@/lib/supabase-server';
import { appUrl } from '@/lib/app-url';
import { canManageBilling } from '@/lib/roles';
import { resolveWorkspaceRoleForUser } from '@/lib/organization-server';
import { isValidStripeCustomerId } from '@/lib/stripe-ids';

export async function POST() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      {
        code: 'stripe_not_configured',
        error: 'Billing is not connected yet. Add the Stripe secret key in the project settings and try again.'
      },
      { status: 503 }
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { code: 'not_signed_in', error: 'Please sign in again to manage billing.' },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  const role = await resolveWorkspaceRoleForUser(supabase, user.id, profile?.role);
  if (!canManageBilling(role)) {
    return NextResponse.json(
      {
        code: 'billing_permission_required',
        error: 'Only the workspace owner or an admin can manage the subscription.'
      },
      { status: 403 }
    );
  }

  const rawCustomerId = profile?.stripe_customer_id;
  const customerId = isValidStripeCustomerId(rawCustomerId) ? rawCustomerId : null;

  if (!customerId) {
    return NextResponse.json(
      {
        code: 'stripe_customer_missing',
        error: 'This account is not linked to a Stripe billing profile yet. Start or restore a web subscription first.'
      },
      { status: 400 }
    );
  }

  try {
    const stripe = new Stripe(stripeKey);
    const customer = await stripe.customers.retrieve(customerId);

    if (customer.deleted) {
      return NextResponse.json(
        {
          code: 'stripe_customer_deleted',
          error: 'The linked Stripe billing profile no longer exists. Contact support to reconnect billing.'
        },
        { status: 409 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: appUrl('/settings/billing')
    });

    if (!session.url) {
      return NextResponse.json(
        {
          code: 'portal_link_missing',
          error: 'Stripe did not return a billing portal link. Please try again in a moment.'
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Unable to create Stripe billing portal session', error);

    const message = error instanceof Error ? error.message : '';
    const portalConfigurationMissing = /portal|configuration|default configuration/i.test(message);

    return NextResponse.json(
      {
        code: portalConfigurationMissing ? 'portal_not_configured' : 'portal_unavailable',
        error: portalConfigurationMissing
          ? 'Stripe Customer Portal is not configured yet. Open Stripe, enable the customer portal, and try again.'
          : 'Billing management is temporarily unavailable. Please try again shortly.'
      },
      { status: 502 }
    );
  }
}
