import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerSupabase } from '@/lib/supabase-server';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { canCancelSubscription } from '@/lib/stripe-subscription';

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
    .select('role, subscription_status')
    .eq('id', user.id)
    .maybeSingle();

  if (!canManageBilling(normalizeRole(profile?.role))) {
    return NextResponse.json({ error: 'Only the company owner can manage billing.' }, { status: 403 });
  }

  if (!canCancelSubscription(profile?.subscription_status)) {
    return NextResponse.json({ error: 'This subscription cannot be canceled from the app right now.' }, { status: 400 });
  }

  const { data: subscription } = await supabase
    .from('everittos_subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', user.id)
    .not('stripe_subscription_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionId = subscription?.stripe_subscription_id;
  if (!subscriptionId) {
    return NextResponse.json(
      { error: 'No active Stripe subscription found. Use the billing portal or contact support.' },
      { status: 400 }
    );
  }

  const stripe = new Stripe(stripeKey);
  const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });

  await supabase
    .from('everittos_subscriptions')
    .update({ status: updated.status })
    .eq('stripe_subscription_id', subscriptionId);

  await supabase
    .from('profiles')
    .update({ subscription_status: updated.status === 'active' ? 'canceled' : updated.status })
    .eq('id', user.id);

  return NextResponse.json({
    ok: true,
    message: 'Subscription set to cancel at period end.',
    status: updated.status
  });
}
