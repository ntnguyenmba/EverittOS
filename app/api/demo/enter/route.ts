import { NextResponse } from 'next/server';
import { isDemoFeatureEnabled } from '@/lib/demo-guard';
import { seedDemoOrganization } from '@/lib/demo-seed-server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';

export async function POST() {
  if (!isDemoFeatureEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Sign in to enter the demo.' }, { status: 401 });
  }

  const result = await seedDemoOrganization(user.id, user.email);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (admin) {
    await admin.from('product_events').insert({
      organization_id: result.organizationId,
      user_id: user.id,
      event_name: 'signup',
      metadata: { demo: true }
    });
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    redirectTo: '/dashboard'
  });
}
