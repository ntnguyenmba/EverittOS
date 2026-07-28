import { NextResponse } from 'next/server';
import { repairClientPortalAccessForUser } from '@/lib/client-portal-repair';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

/** Idempotent repair for existing client accounts with incomplete invite relationships. */
export async function POST() {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await repairClientPortalAccessForUser(admin, user.id, user.email);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
