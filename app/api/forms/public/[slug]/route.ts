import { NextResponse } from 'next/server';
import { normalizeEstimateSettings } from '@/lib/estimate-engine';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createServerSupabase();
  const { data: form, error } = await supabase.from('everitt_forms').select('id, name, slug, form_type, description, active, settings').eq('slug', slug).eq('active', true).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  const { data: fields } = await supabase.from('everitt_form_fields').select('id, label, field_type, required, sort_order, options').eq('form_id', form.id).order('sort_order', { ascending: true });
  return NextResponse.json({
    form: {
      id: form.id,
      name: form.name,
      slug: form.slug,
      form_type: form.form_type,
      description: form.description,
      estimate_settings: form.form_type === 'estimate' ? normalizeEstimateSettings(form.settings) : null
    },
    fields: fields || []
  });
}
