import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { canManageTeam } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_RECORD_TYPES = new Set(['job', 'customer', 'photo', 'report', 'note', 'document']);
const ALLOWED_ACCESS_LEVELS = new Set(['view', 'edit']);

export async function GET(request: Request) {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const url = new URL(request.url);
  const recordType = url.searchParams.get('recordType') || '';
  const recordId = url.searchParams.get('recordId') || '';

  if (!ALLOWED_RECORD_TYPES.has(recordType) || !recordId) {
    return NextResponse.json({ error: 'Valid record type and record ID are required.' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('record_shares')
    .select('id, record_type, record_id, shared_with_user_id, access_level, created_at')
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('record_type', recordType)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ shares: data || [] });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  const admin = createAdminSupabase();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }
  if (!admin) {
    return NextResponse.json({ error: 'Server is not configured for sharing.' }, { status: 500 });
  }
  if (!canManageTeam(ctx.workspace.role) && ctx.workspace.role !== 'manager') {
    return NextResponse.json({ error: 'Only owners, admins, and managers can share records.' }, { status: 403 });
  }

  const body = (await request.json()) as {
    recordType?: string;
    recordId?: string;
    userIds?: string[];
    accessLevel?: string;
  };

  const recordType = body.recordType || '';
  const recordId = body.recordId || '';
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter(Boolean) : [];
  const accessLevel = body.accessLevel || 'view';

  if (!ALLOWED_RECORD_TYPES.has(recordType) || !recordId) {
    return NextResponse.json({ error: 'Valid record type and record ID are required.' }, { status: 400 });
  }
  if (!ALLOWED_ACCESS_LEVELS.has(accessLevel)) {
    return NextResponse.json({ error: 'Access level must be view or edit.' }, { status: 400 });
  }
  if (userIds.length === 0) {
    return NextResponse.json({ error: 'Choose at least one teammate to share with.' }, { status: 400 });
  }

  const { data: members, error: memberError } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('active', true)
    .in('user_id', userIds);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  const allowedUserIds = new Set((members || []).map((member) => member.user_id));
  const rows = userIds
    .filter((userId) => allowedUserIds.has(userId))
    .map((userId) => ({
      organization_id: ctx.workspace.organizationId,
      record_type: recordType,
      record_id: recordId,
      shared_with_user_id: userId,
      shared_by_user_id: ctx.userId,
      access_level: accessLevel
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Selected users are not active members of this workspace.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('record_shares')
    .upsert(rows, { onConflict: 'organization_id,record_type,record_id,shared_with_user_id' })
    .select('id, record_type, record_id, shared_with_user_id, access_level, created_at');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, shares: data || [] });
}

export async function DELETE(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  const admin = createAdminSupabase();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }
  if (!admin) {
    return NextResponse.json({ error: 'Server is not configured for sharing.' }, { status: 500 });
  }

  const url = new URL(request.url);
  const shareId = url.searchParams.get('id');
  if (!shareId) {
    return NextResponse.json({ error: 'Share ID is required.' }, { status: 400 });
  }

  const { error } = await admin
    .from('record_shares')
    .delete()
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('id', shareId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
