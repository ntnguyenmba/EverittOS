import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { requireWorkspaceSession } from '@/lib/workspace-api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanText(value?: string | null): string | null {
  const text = (value || '').trim();
  return text || null;
}

export async function GET() {
  const ctx = await requireWorkspaceSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { data, error } = await ctx.supabase
    .from('teams')
    .select('id, name, description, color, active, created_at')
    .eq('organization_id', ctx.workspace.organizationId)
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ teams: data || [] });
}

export async function POST(request: Request) {
  const ctx = await requireWorkspaceSession({ requireManager: true });
  const admin = createAdminSupabase();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }
  if (!admin) {
    return NextResponse.json({ error: 'Server is not configured for teams.' }, { status: 500 });
  }

  const body = (await request.json()) as { name?: string; description?: string | null; color?: string | null };
  const name = cleanText(body.name);
  if (!name) {
    return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('teams')
    .insert({
      organization_id: ctx.workspace.organizationId,
      name,
      description: cleanText(body.description),
      color: cleanText(body.color),
      created_by: ctx.userId,
      active: true
    })
    .select('id, name, description, color, active, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, team: data });
}
