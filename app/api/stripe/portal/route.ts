import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerSupabase } from '@/lib/supabase-server';
import { appUrl } from '@/lib/app-url';
import { canManageBilling, normalizeRole } from '@/lib/roles';

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

  const { data: profile } = await supabase.from('profiles').select('role, stripe_customer_id, email').eq('id', user.id).maybeSingle();
  if (!canManageBilling(normalizeRole(profile?.role))) {
    return NextResponse.json({ error: 'Only workspace owners and admins can manage billing.' }, { status: 403 });
  }

  const customerId = profile?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json(
      { error: 'No Stripe customer on file. Complete a paid checkout first or contact support.' },
      { status: 400 }
    );
  }

  const stripe = new Stripe(stripeKey);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: appUrl('/settings/billing')
  });

  return NextResponse.json({ url: session.url });
}
