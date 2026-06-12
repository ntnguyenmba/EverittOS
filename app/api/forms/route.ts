import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { slugifyFormName } from '@/lib/forms-utils';
import { requireOrganizationSession } from '@/lib/organization-api-auth';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireOrganizationSession();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const { data, error } = await ctx.supabase
    .from('everitt_forms')
    .select('id, name, slug, form_type, active, description, created_at, updated_at')
    .eq('organization_id', ctx.workspace.organizationId)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ forms: data || [] });
}

export async function POST(request: Request) {
  const ctx = await requireOrganizationSession({ requireSettingsManager: true });
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });
  }

  const body = (await request.json()) as {
    name?: string;
    form_type?: string;
    description?: string;
    fields?: { label: string; field_type?: string; required?: boolean }[];
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Form name is required.' }, { status: 400 });
  }

  const slug = `${slugifyFormName(body.name)}-${Date.now().toString(36).slice(-4)}`;

  const { data: form, error } = await ctx.supabase
    .from('everitt_forms')
    .insert({
      organization_id: ctx.workspace.organizationId,
      name: body.name.trim(),
      slug,
      form_type: body.form_type || 'contact',
      description: body.description?.trim() || null,
      created_by: ctx.userId
    })
    .select('*')
    .single();

  if (error || !form) {
    return NextResponse.json(
      { error: mapWorkspaceSaveError(error?.message || '', 'Unable to save form. Please try again.') },
      { status: 400 }
    );
  }

  const fields = body.fields || [
    { label: 'Name', field_type: 'text', required: true },
    { label: 'Email', field_type: 'email', required: true },
    { label: 'Message', field_type: 'textarea', required: false }
  ];

  await ctx.supabase.from('everitt_form_fields').insert(
    fields.map((f, i) => ({
      form_id: form.id,
      organization_id: ctx.workspace.organizationId,
      label: f.label,
      field_type: f.field_type || 'text',
      required: Boolean(f.required),
      sort_order: i
    }))
  );

  await logActivityServer({
    organizationId: ctx.workspace.organizationId,
    userId: ctx.userId,
    entityType: 'form',
    entityId: form.id,
    action: 'form_created',
    message: `Form created: ${form.name}`
  });

  return NextResponse.json({ form, message: 'Form saved successfully.' });
}
