import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerSupabase } from '@/lib/supabase-server';
import { appUrl } from '@/lib/app-url';
import { canManageBilling } from '@/lib/roles';
import { resolveWorkspaceRoleForUser } from '@/lib/organization-server';
import { isValidStripeCustomerId } from '@/lib/stripe-ids';

export async function POST() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
