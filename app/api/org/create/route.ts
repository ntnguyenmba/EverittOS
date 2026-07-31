import { NextResponse } from 'next/server';
import { ACTIVE_ORG_COOKIE } from '@/lib/org-context-cookie';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanCompanyName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 120) : '';
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { companyName?: string };
  const companyName = cleanCompanyName(body.companyName);
  if (companyName.length < 2) {
    return NextResponse.json({ error: 'Enter a company name.' }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const { data: existing } = await admin
    .from('organizations')
    .select('id, name')
    .eq('owner_user_id', user.id)
    .ilike('name', companyName)
    .maybeSingle();

  let organizationId = existing?.id as string | undefined;
  let createdOrganization = false;

  if (!organizationId) {
    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert({ name: companyName, owner_user_id: user.id })
      .select('id')
      .single();

    if (organizationError || !organization) {
      return NextResponse.json({ error: organizationError?.message || 'Could not create company.' }, { status: 500 });
    }

    organizationId = organization.id;
    createdOrganization = true;
  }

  const { error: membershipError } = await admin.from('organization_members').upsert(
    {
      organization_id: organizationId,
      user_id: user.id,
      role: 'owner',
      active: true
    },
    { onConflict: 'organization_id,user_id' }
  );

  if (membershipError) {
    if (createdOrganization) {
      await admin.from('organizations').delete().eq('id', organizationId).eq('owner_user_id', user.id);
    }
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ organization_id: organizationId, role: 'owner', business_name: companyName })
    .eq('id', user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!organizationId) {
    return NextResponse.json({ error: 'Could not resolve company.' }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, organizationId, companyName });
  response.cookies.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}
