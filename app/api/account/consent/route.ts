import { NextResponse } from 'next/server';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal-versions';
import { trackProductEventServer } from '@/lib/product-analytics-server';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/** Record terms and privacy acceptance for the authenticated user. */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const acceptTerms = body.acceptTerms !== false;
  const acceptPrivacy = body.acceptPrivacy !== false;

  if (!acceptTerms || !acceptPrivacy) {
    return NextResponse.json({ error: 'Terms and Privacy Policy acceptance is required.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({
      terms_accepted_at: now,
      privacy_accepted_at: now,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION
    })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();

  await trackProductEventServer(supabase, 'signup', {
    organizationId: profile?.organization_id,
    userId: user.id,
    metadata: { consentRecorded: true }
  });

  return NextResponse.json({
    ok: true,
    termsAcceptedAt: now,
    privacyAcceptedAt: now,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION
  });
}
