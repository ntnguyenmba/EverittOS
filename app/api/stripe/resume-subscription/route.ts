import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { canManageBilling, normalizeRole } from '@/lib/roles';
import { canResumeSubscription } from '@/lib/stripe-subscription';

export async function POST() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
  }

  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, subscription_status, plan')
    .eq('id', user.id)
    .maybeSingle();

  if (!canManageBilling(normalizeRole(profile?.role))) {
    return NextResponse.json({ error: 'Only workspace owners and admins can manage billing.' }, { status: 403 });
  }

  if (!canResumeSubscription(profile?.subscription_status)) {
    return NextResponse.json({ error: 'This subscription is not eligible to resume.' }, { status: 400 });
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
      { error: 'No Stripe subscription found. Start a new plan from billing or contact support.' },
      { status: 400 }
    );
  }

  const stripe = new Stripe(stripeKey);
  const updated = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false
  });

  const planStatus = profile?.plan && profile.plan !== 'free' ? `everittos_${profile.plan}` : 'active';

  await admin
    .from('everittos_subscriptions')
    .update({
      status: updated.status,
      cancel_at_period_end: false
    })
    .eq('stripe_subscription_id', subscriptionId);

  await admin.from('profiles').update({ subscription_status: planStatus }).eq('id', user.id);

  return NextResponse.json({
    ok: true,
    message: 'Subscription resumed.',
    status: updated.status
  });
}
