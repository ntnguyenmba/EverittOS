import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import type { TemplateCategory } from '@/lib/os-types';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORIES: TemplateCategory[] = [
  'sop',
  'proposal',
  'contract',
  'estimate',
  'invoice',
  'email',
  'checklist',
  'workflow'
];

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const category = new URL(request.url).searchParams.get('category');
  let query = supabase
    .from('template_library')
    .select('id, category, title, body, version, created_at, updated_at')
    .eq('organization_id', org.organizationId)
    .order('updated_at', { ascending: false });

  if (category && CATEGORIES.includes(category as TemplateCategory)) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data || [], categories: CATEGORIES });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as { title?: string; category?: string; body?: string };
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const category = CATEGORIES.includes(body.category as TemplateCategory) ? body.category : 'sop';

  const { data, error } = await supabase
    .from('template_library')
    .insert({
      organization_id: org.organizationId,
      title: body.title.trim(),
      category,
      body: body.body?.trim() || '',
      created_by: user.id
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivityServer({
    organizationId: org.organizationId,
    userId: user.id,
    entityType: 'template',
    entityId: data.id,
    action: 'template_created',
    message: `Template created: ${data.title}`
  });

  return NextResponse.json({ template: data });
}
