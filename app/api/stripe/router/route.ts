import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type ReRootPlan = 'monthly' | 'yearly' | 'report';
type ReRootStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' | 'refunded' | 'inactive';

function normalizePlan(value: string | null | undefined): ReRootPlan | null {
  const plan = String(value || '').trim().toLowerCase();
  if (plan === 'annual') return 'yearly';
  if (plan === 'plan') return 'report';
