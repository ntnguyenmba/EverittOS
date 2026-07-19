import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { POST as handleEverittOSWebhook } from '../webhook/route';

export const runtime = 'nodejs';

type ReRootPlan = 'monthly' | 'yearly' | 'report';

type ReRootEntitlement = {
  user_id: string | null;
  email: string;
  provider: 'stripe';
  product_id: string | null;
  plan: ReRootPlan;
  purchase_type: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;