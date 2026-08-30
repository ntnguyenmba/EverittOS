import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { DEFAULT_ESTIMATE_SETTINGS } from '@/lib/estimate-engine';
import { slugifyFormName } from '@/lib/forms-utils';
import { requireOrganizationSession } from '@/lib/organization-api-auth';
import { mapWorkspaceSaveError } from '@/lib/workspace-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ESTIMATE_FIELDS = [
  { label: 'Name', field_type: 'text', required: true },
  { label: 'Phone', field_type: 'phone', required: false },
  { label: 'Email', field_type: 'email', required: false },
  { label: 'Service address', field_type: 'text', required: true },
  { label: 'Service type', field_type: 'select', required: true, options: ['Standard cleaning', 'Deep cleaning', 'Move-in / Move-out'] },
  { label: 'Bedrooms', field_type: 'select', required: true, options: ['1', '2', '3', '4', '5', '6+'] },
  { label: 'Bathrooms', field_type: 'select', required: true, options: ['1', '2', '3', '4', '5', '6+'] },
  { label: 'Approx. sq ft', field_type: 'text', required: false },
  { label: 'Frequency', field_type: 'select', required: true, options: ['One-time', 'Weekly', 'Bi-weekly', 'Monthly'] },
  { label: 'Add-ons', field_type: 'textarea', required: false },
  { label: 'Notes', field_type: 'textarea', required: false }
];

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

  if (error) return NextResponse.json({ error: mapWorkspaceSaveError(error.message) }, { status: 500 });
  return NextResponse.json({ forms: data || [] });
}

export async function POST(request: Request) {
  const ctx = await requireOrganizationSession({ requireSettingsManager: true });
  if (!ctx.ok) return NextResponse.json({ error: ctx.error, code: ctx.code }, { status: ctx.status });

  const body = (await request.json()) as {
    name?: string;
    form_type?: string;
    description?: string;
    fields?: { label: string; field_type?: string; required?: boolean; options?: string[] }[];
  };

  if (!body.name?.trim()) return NextResponse.json({ error: 'Form name is required.' }, { status: 400 });

  const formType = body.form_type || 'contact';
  const slug = `${slugifyFormName(body.name)}-${Date.now().toString(36).slice(-4)}`;
  const isEstimate = formType === 'estimate';

  const { data: form, error } = await ctx.supabase
    .from('everitt_forms')
    .insert({
      organization_id: ctx.workspace.organizationId,
      name: body.name.trim(),
      slug,
      form_type: formType,
      description: body.description?.trim() || (isEstimate ? 'Tell us about the work and get a helpful starting range.' : null),
      settings: isEstimate ? { estimate: DEFAULT_ESTIMATE_SETTINGS } : {},
      created_by: ctx.userId
    })
    .select('*')
    .single();

  if (error || !form) {
    return NextResponse.json({ error: mapWorkspaceSaveError(error?.message || '', 'Unable to save form. Please try again.') }, { status: 400 });
  }

  const fields = body.fields || (isEstimate ? ESTIMATE_FIELDS : [
    { label: 'Name', field_type: 'text', required: true },
    { label: 'Email', field_type: 'email', required: true },
    { label: 'Message', field_type: 'textarea', required: false }
  ]);

  const { error: fieldsError } = await ctx.supabase.from('everitt_form_fields').insert(
    fields.map((field, index) => ({
      form_id: form.id,
      organization_id: ctx.workspace.organizationId,
      label: field.label,
      field_type: field.field_type || 'text',
      required: Boolean(field.required),
      sort_order: index,
      options: field.options || []
    }))
  );

  if (fieldsError) {
    await ctx.supabase.from('everitt_forms').delete().eq('id', form.id).eq('organization_id', ctx.workspace.organizationId);
    return NextResponse.json({ error: mapWorkspaceSaveError(fieldsError.message, 'Unable to create form fields.') }, { status: 400 });
  }

  await logActivityServer({
    organizationId: ctx.workspace.organizationId,
    userId: ctx.userId,
    entityType: 'form',
    entityId: form.id,
    action: 'form_created',
    message: `Form created: ${form.name}`
  });

  return NextResponse.json({ form, message: isEstimate ? 'Estimate form is ready.' : 'Form saved successfully.' });
}
