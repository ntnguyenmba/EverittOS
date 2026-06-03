import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase-admin';
import type { EverittosPlan } from '@/lib/everittos-plans';

export const runtime = 'nodejs';

/** Stripe Payment Links: set metadata `plan` = `pro` or `business` on each link (recommended). */
function planFromSession(session: Stripe.Checkout.Session): EverittosPlan | null {
  const meta = (session.metadata?.plan || session.client_reference_id || '').toLowerCase();
  if (meta === 'pro' || meta === 'business') return meta;

  const amount = session.amount_total || 0;
  if (amount === 900 || amount === 9) return 'pro';
  if (amount === 3900 || amount === 39) return 'business';

  return null;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!secret || !stripeKey) {
    return NextResponse.json(
      { error: 'Stripe webhook is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.' },
      { status: 503 }
    );
  }

  const stripe = new Stripe(stripeKey);
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email || session.customer_email;
    const plan = planFromSession(session);

    if (!email || !plan) {
      return NextResponse.json({ received: true, warning: 'missing_email_or_plan' });
    }

    const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();

    if (profile?.id) {
      await admin
        .from('profiles')
        .update({
          plan,
          subscription_status: `everittos_${plan}`,
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id || null
        })
        .eq('id', profile.id);

      await admin.from('everittos_subscriptions').upsert(
        {
          user_id: profile.id,
          email,
          plan,
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
          stripe_session_id: session.id,
          status: 'active'
        },
        { onConflict: 'stripe_session_id' }
      );
    } else {
      await admin.from('everittos_subscriptions').upsert(
        {
          email,
          plan,
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
          stripe_session_id: session.id,
          status: 'active'
        },
        { onConflict: 'stripe_session_id' }
      );
    }
  }

  return NextResponse.json({ received: true });
}
