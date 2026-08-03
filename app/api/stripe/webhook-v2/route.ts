import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { POST as processStripeWebhook } from '@/app/api/stripe/webhook/route';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const SYNC_REQUIRED_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_succeeded'
]);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const signature = request.headers.get('stripe-signature');

  if (!secret || !stripeKey) {
    return NextResponse.json({ error: 'Stripe billing is not configured.' }, { status: 503 });
  }
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const body = await request.clone().text();
  const stripe = new Stripe(stripeKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid signature' },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server billing configuration is incomplete.' }, { status: 503 });
  }

  const { data: completed } = await admin
    .from('subscription_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .ilike('event_type', 'webhook.sync.ok:%')
    .limit(1)
    .maybeSingle();

  if (!completed?.id) {
    const { error: releaseError } = await admin
      .from('subscription_events')
      .delete()
      .eq('stripe_event_id', event.id)
      .ilike('event_type', 'webhook.claimed:%');

    if (releaseError) {
      return NextResponse.json(
        { error: `Unable to release failed webhook claim: ${releaseError.message}` },
        { status: 500 }
      );
    }
  }

  const response = await processStripeWebhook(request);
  if (!response.ok) return response;
  if (!SYNC_REQUIRED_EVENTS.has(event.type)) return response;

  const { data: synced, error: syncReadError } = await admin
    .from('subscription_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .ilike('event_type', 'webhook.sync.ok:%')
    .limit(1)
    .maybeSingle();

  if (syncReadError) {
    return NextResponse.json({ error: 'Unable to confirm billing activation.' }, { status: 500 });
  }

  if (!synced?.id) {
    await admin
      .from('subscription_events')
      .delete()
      .eq('stripe_event_id', event.id)
      .ilike('event_type', 'webhook.claimed:%');

    return NextResponse.json(
      { error: 'Billing activation did not complete. Stripe should retry this event.' },
      { status: 500 }
    );
  }

  return response;
}
