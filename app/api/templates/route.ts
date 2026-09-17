import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { fetchOrganizationContextWithRepair } from '@/lib/workspace-server';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import type { TemplateCategory } from '@/lib/os-types';
import { createServerSupabase } from '@/lib/supabase-server';
import { isMissingSchemaError, schemaEmptyPayload } from '@/lib/supabase-schema-errors';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getTemplateApiCopy } from '@/lib/i18n/template-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORIES: TemplateCategory[] = ['sop','proposal','contract','estimate','invoice','email','checklist','workflow'];

export async function GET(request: Request) {
  const c = getTemplateApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, { email: user.email || '', userMetadata: user.user_metadata || undefined });
  if (!org) return NextResponse.json({ error: c.organizationNotFound }, { status: 404 });

  const category = new URL(request.url).searchParams.get('category');
  let query = supabase.from('template_library').select('id, category, title, body, version, created_at, updated_at').eq('organization_id', org.organizationId).order('updated_at', { ascending: false });
  if (category && CATEGORIES.includes(category as TemplateCategory)) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) {
    if (isMissingSchemaError(error)) return NextResponse.json(schemaEmptyPayload('templates', { categories: CATEGORIES }));
    return NextResponse.json({ error: c.loadTemplates }, { status: 500 });
  }
  return NextResponse.json({ templates: data || [], categories: CATEGORIES, schemaReady: true });
}

export async function POST(request: Request) {
  const c = getTemplateApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, { email: user.email || '', userMetadata: user.user_metadata || undefined });
  if (!org || !canManageOrganizationSettings(normalizeRole(org.role))) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const body = (await request.json()) as { title?: string; category?: string; body?: string };
  if (!body.title?.trim()) return NextResponse.json({ error: c.titleRequired }, { status: 400 });
  const category = CATEGORIES.includes(body.category as TemplateCategory) ? body.category : 'sop';

  const { data, error } = await supabase.from('template_library').insert({ organization_id: org.organizationId, title: body.title.trim(), category, body: body.body?.trim() || '', created_by: user.id }).select('*').single();
  if (error) return NextResponse.json({ error: c.saveTemplate }, { status: isMissingSchemaError(error) ? 503 : 400 });

  await logActivityServer({ organizationId: org.organizationId, userId: user.id, entityType: 'template', entityId: data.id, action: 'template_created', message: `Template created: ${data.title}` });
  return NextResponse.json({ template: data });
}
