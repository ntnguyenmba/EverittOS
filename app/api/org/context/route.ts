import { NextResponse } from 'next/server';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const organization = await fetchOrganizationContextForRequest(supabase, user.id);
  if (!organization) {
    return NextResponse.json({ organization: null }, { status: 200 });
  }

  return NextResponse.json({ organization }, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' }
  });
}
