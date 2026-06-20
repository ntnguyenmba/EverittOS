import { NextResponse } from 'next/server';
import { BILLING_UI_BUILD_ID } from '@/lib/billing-plan-card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lightweight marker so production can confirm the billing UI build is live. */
export async function GET() {
  return NextResponse.json({
    billingUiBuildId: BILLING_UI_BUILD_ID,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_SHA || null,
    deployedAt: process.env.VERCEL_DEPLOYMENT_ID || null
  });
}
