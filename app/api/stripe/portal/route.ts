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
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  const role = await resolveWorkspaceRoleForUser(supabase, user.id, profile?.role);
  if (!canManageBilling(role)) {
    return NextResponse.json(
      { error: 'Only workspace owners and admins can manage billing.' },
      { status: 403 }
    );
  }

  const rawCustomerId = profile?.stripe_customer_id;
  const customerId = isValidStripeCustomerId(rawCustomerId) ? rawCustomerId : null;

  if (!customerId) {
    return NextResponse.json(
      { error: 'No Stripe customer is connected to this account.' },
      { status: 400 }
    );
  }

  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: appUrl('/settings/billing')
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe did not return a billing portal link.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Unable to create Stripe billing portal session', error);
    return NextResponse.json(
      {
        error:
          'Unable to open billing management. Check the Stripe Customer Portal configuration and try again.'
      },
      { status: 502 }
    );
  }
}
