import { NextResponse } from 'next/server';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getOrgApiCopy } from '@/lib/i18n/org-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const c = getOrgApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const organization = await fetchOrganizationContextForRequest(supabase, user.id);
  if (!organization) return NextResponse.json({ organization: null }, { status: 200 });

  return NextResponse.json({ organization }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
