import { NextResponse } from 'next/server';
import {
  trackOnboardingAbandoned,
  trackOnboardingCompleted,
  trackOnboardingStepSkipped
} from '@/lib/onboarding/analytics';
import { ONBOARDING_STEP_COUNT } from '@/lib/onboarding/constants';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

type DismissAction = 'skip_all' | 'cancel';

/** Mark setup as dismissed so the user is not sent back into onboarding. */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return NextResponse.json({ error: 'Workspace is still setting up.' }, { status: 400 });
  }

  let body: { action?: DismissAction; step?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const action: DismissAction = body.action === 'cancel' ? 'cancel' : 'skip_all';
  const step = typeof body.step === 'number' ? body.step : 0;

  const { error } = await supabase.from('organization_settings').upsert({
    organization_id: org.organizationId,
    onboarding_step: ONBOARDING_STEP_COUNT,
    onboarding_completed: true,
    onboarding_skipped: true
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (action === 'cancel') {
    await trackOnboardingAbandoned(org.organizationId, step, { action: 'cancel' });
  } else {
    await trackOnboardingStepSkipped(org.organizationId, step, { action: 'skip_all' });
  }
  await trackOnboardingCompleted(org.organizationId, { skipped: true, action });

  return NextResponse.json({ ok: true });
}
