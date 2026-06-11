import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { isOwner } from '@/lib/roles';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !isOwner(org.role)) {
    return NextResponse.json({ error: 'Only the organization owner can transfer ownership' }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string };
  const targetUserId = body.userId;
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: 'You are already the owner' }, { status: 400 });
  }

  const { data: targetMember } = await admin
    .from('organization_members')
    .select('user_id, role, active')
    .eq('organization_id', org.organizationId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!targetMember || !targetMember.active) {
    return NextResponse.json({ error: 'Target member not found or inactive' }, { status: 404 });
  }

  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'Target user is already the owner' }, { status: 400 });
  }

  const { error: demoteError } = await admin
    .from('organization_members')
    .update({ role: 'admin' })
    .eq('organization_id', org.organizationId)
    .eq('user_id', user.id);

  if (demoteError) {
    return NextResponse.json({ error: demoteError.message }, { status: 400 });
  }

  const { error: promoteError } = await admin
    .from('organization_members')
    .update({ role: 'owner' })
    .eq('organization_id', org.organizationId)
    .eq('user_id', targetUserId);

  if (promoteError) {
    await admin.from('organization_members').update({ role: 'owner' }).eq('organization_id', org.organizationId).eq('user_id', user.id);
    return NextResponse.json({ error: promoteError.message }, { status: 400 });
  }

  await admin.from('profiles').update({ role: 'admin' }).eq('id', user.id);
  await admin.from('profiles').update({ role: 'owner' }).eq('id', targetUserId);
  await admin.from('organizations').update({ owner_user_id: targetUserId }).eq('id', org.organizationId);

  return NextResponse.json({ ok: true, message: 'Ownership transferred successfully.' });
}
