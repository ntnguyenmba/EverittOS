import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';
import { canManageTeam } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_RECORD_TYPES = new Set(['job', 'customer', 'photo', 'report', 'note', 'document']);
const ALLOWED_ACCESS_LEVELS = new Set(['view', 'edit']);

function recordTitle(recordType: string): string {
  if (recordType === 'job') return 'Job available';
  if (recordType === 'customer') return 'Customer record shared with you';
  if (recordType === 'photo') return 'Photo shared with you';
  if (recordType === 'report') return 'Report shared with you';
  if (recordType === 'note') return 'Note shared with you';
  if (recordType === 'document') return 'Document shared with you';
  return 'Record shared with you';
}

function recordBody(recordType: string, accessLevel: string): string {
  if (recordType === 'job') return 'A job is available for you to review.';
  return `You now have ${accessLevel} access to a ${recordType} record.`;
}

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
    email?: string;
    accessLevel?: string;
    accessRole?: string;
  };

  const recordType = body.recordType || '';
  const recordId = body.recordId || '';
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter(Boolean) : [];
  const email = (body.email || '').trim().toLowerCase();
  const accessLevel = body.accessLevel || 'view';
  const accessRole = body.accessRole?.trim() || null;

  if (!ALLOWED_RECORD_TYPES.has(recordType) || !recordId) {
    return NextResponse.json({ error: 'Valid record type and record ID are required.' }, { status: 400 });
  }
  if (!ALLOWED_ACCESS_LEVELS.has(accessLevel)) {
    return NextResponse.json({ error: 'Access level must be view or edit.' }, { status: 400 });
  }

  const resolvedUserIds = [...userIds];
  if (email) {
    const { data: profile } = await admin.from('profiles').select('id').ilike('email', email).maybeSingle();
    if (!profile?.id) {
      return NextResponse.json(
        { error: 'No company person found for that email. Add them to your team first, or use Client access for customers.' },
        { status: 400 }
      );
    }
    if (!resolvedUserIds.includes(profile.id)) resolvedUserIds.push(profile.id);
  }

  if (resolvedUserIds.length === 0) {
    return NextResponse.json({ error: 'Choose an existing person or enter their email.' }, { status: 400 });
  }

  const { data: members, error: memberError } = await admin
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('active', true)
    .in('user_id', resolvedUserIds);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  const allowedMembers = (members || []).filter((member) => {
    // Assigned contractors receive job access automatically; do not create manual job shares for them.
    if (recordType === 'job' && String(member.role || '').toLowerCase() === 'contractor') return false;
    return true;
  });
  const allowedUserIds = new Set(allowedMembers.map((member) => member.user_id));
  const rows = resolvedUserIds
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
    return NextResponse.json(
      {
        error:
          recordType === 'job'
            ? 'Assigned contractors already receive access automatically. Choose a manager, office staff, or other non-contractor person.'
            : 'Selected users are not active members of this workspace.'
      },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from('record_shares')
    .upsert(rows, { onConflict: 'organization_id,record_type,record_id,shared_with_user_id' })
    .select('id, record_type, record_id, shared_with_user_id, access_level, created_at');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logWorkspaceActivity(
    ctx.workspace.organizationId,
    ctx.userId,
    recordType,
    recordId,
    'record_shared',
    `${recordType} shared with ${rows.length} person${rows.length === 1 ? '' : 's'}`,
    {
      recordType,
      recordId,
      userIds: rows.map((row) => row.shared_with_user_id),
      accessLevel,
      accessRole
    }
  );

  await admin.from('notifications').insert(
    rows.map((row) => ({
      organization_id: ctx.workspace.organizationId,
      user_id: row.shared_with_user_id,
      type: 'assignment',
      title: recordTitle(recordType),
      body: recordBody(recordType, accessLevel),
      related_job_id: recordType === 'job' ? recordId : null
    }))
  );

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

  const { data: share } = await admin
    .from('record_shares')
    .select('record_type, record_id, shared_with_user_id, access_level')
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('id', shareId)
    .maybeSingle();

  const { error } = await admin
    .from('record_shares')
    .delete()
    .eq('organization_id', ctx.workspace.organizationId)
    .eq('id', shareId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (share) {
    await logWorkspaceActivity(
      ctx.workspace.organizationId,
      ctx.userId,
      share.record_type,
      share.record_id,
      'record_unshared',
      `${share.record_type} shared access removed`,
      { shareId, sharedWithUserId: share.shared_with_user_id, accessLevel: share.access_level }
    );
  }

  return NextResponse.json({ ok: true });
}
