import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { slugifyFormName } from '@/lib/forms-utils';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageOrganizationSettings, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('everitt_forms')
    .select('id, name, slug, form_type, active, description, created_at, updated_at')
    .eq('organization_id', org.organizationId)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ forms: data || [] });
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

  const body = (await request.json()) as {
    name?: string;
    form_type?: string;
    description?: string;
    fields?: { label: string; field_type?: string; required?: boolean }[];
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const slug = `${slugifyFormName(body.name)}-${Date.now().toString(36).slice(-4)}`;

  const { data: form, error } = await supabase
    .from('everitt_forms')
    .insert({
      organization_id: org.organizationId,
      name: body.name.trim(),
      slug,
      form_type: body.form_type || 'contact',
      description: body.description?.trim() || null,
      created_by: user.id
    })
    .select('*')
    .single();

  if (error || !form) {
    return NextResponse.json({ error: error?.message || 'Failed to create form' }, { status: 400 });
  }

  const fields = body.fields || [
    { label: 'Name', field_type: 'text', required: true },
    { label: 'Email', field_type: 'email', required: true },
    { label: 'Message', field_type: 'textarea', required: false }
  ];

  await supabase.from('everitt_form_fields').insert(
    fields.map((f, i) => ({
      form_id: form.id,
      organization_id: org.organizationId,
      label: f.label,
      field_type: f.field_type || 'text',
      required: Boolean(f.required),
      sort_order: i
    }))
  );

  await logActivityServer({
    organizationId: org.organizationId,
    userId: user.id,
    entityType: 'form',
    entityId: form.id,
    action: 'form_created',
    message: `Form created: ${form.name}`
  });

  return NextResponse.json({ form });
}
