import { NextResponse } from 'next/server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import { publicErrorMessage } from '@/lib/safe-api-error';

export const runtime = 'nodejs';

/** Reset onboarding so the workspace can walk through setup again. */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { error } = await supabase.from('organization_settings').upsert({
    organization_id: org.organizationId,
    onboarding_step: 0,
    onboarding_completed: false,
    onboarding_skipped: false
  });

  if (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
