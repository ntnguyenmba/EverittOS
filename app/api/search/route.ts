import { NextResponse } from 'next/server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canSeeOrgWideData } from '@/lib/permissions';
import type { SearchResultItem } from '@/lib/os-types';
import { customerDisplayName } from '@/lib/customer-record';
import { createServerSupabase } from '@/lib/supabase-server';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canSeeOrgWideData(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (q.length < 2) {
    return NextResponse.json({ results: [] as SearchResultItem[] });
  }

  const pattern = `%${q}%`;
  const orgId = org.organizationId;

  const [customers, properties, jobs, invoices, contractors, tasks, docs, templates, forms] = await Promise.all([
    supabase
      .from('customers')
      .select('id, company_name, email, phone')
      .eq('organization_id', orgId)
      .or(
        `company_name.ilike."${pattern}",email.ilike."${pattern}",phone.ilike."${pattern}",address_line1.ilike."${pattern}",service_address.ilike."${pattern}"`
      )
      .limit(8),
    supabase
      .from('customer_properties')
      .select('id, customer_id, name, formatted_address, address, city, property_type')
      .eq('organization_id', orgId)
      .eq('is_archived', false)
      .or(
        `name.ilike."${pattern}",formatted_address.ilike."${pattern}",address.ilike."${pattern}",city.ilike."${pattern}"`
      )
      .limit(8),
    supabase
      .from('jobs')
      .select('id, title, customer_name, address, phone')
      .eq('organization_id', orgId)
      .or(`title.ilike."${pattern}",customer_name.ilike."${pattern}",address.ilike."${pattern}",phone.ilike."${pattern}"`)
      .limit(8),
    supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, status')
      .eq('organization_id', orgId)
      .or(`invoice_number.ilike."${pattern}",customer_name.ilike."${pattern}"`)
      .limit(6),
    supabase
      .from('workers')
      .select('id, name, phone, email')
      .eq('organization_id', orgId)
      .or(`name.ilike."${pattern}",phone.ilike."${pattern}",email.ilike."${pattern}"`)
      .limit(6),
    supabase
      .from('os_tasks')
      .select('id, title, status')
      .eq('organization_id', orgId)
      .ilike('title', pattern)
      .limit(6),
    supabase
      .from('knowledge_documents')
      .select('id, title, category')
      .eq('organization_id', orgId)
      .ilike('title', pattern)
      .limit(6),
    supabase
      .from('template_library')
      .select('id, title, category')
      .eq('organization_id', orgId)
      .ilike('title', pattern)
      .limit(6),
    supabase
      .from('everitt_forms')
      .select('id, name, slug')
      .eq('organization_id', orgId)
      .ilike('name', pattern)
      .limit(6)
  ]);

  const results: SearchResultItem[] = [];

  for (const c of customers.data || []) {
    results.push({
      id: c.id,
      type: 'customer',
      title: customerDisplayName(c),
      subtitle: [c.email, c.phone].filter(Boolean).join(' · ') || null,
      href: `/customers/${c.id}`
    });
  }

  if (!properties.error || !isMissingSchemaError(properties.error)) {
    for (const p of properties.data || []) {
      results.push({
        id: p.id,
        type: 'property',
        title: p.name,
        subtitle: p.formatted_address || p.address || p.city || p.property_type || null,
        href: `/customers/${p.customer_id}?propertyId=${p.id}`
      });
    }
  }

  for (const j of jobs.data || []) {
    results.push({
      id: j.id,
      type: 'job',
      title: j.title,
      subtitle: [j.customer_name, j.address].filter(Boolean).join(' · ') || null,
      href: `/jobs/${j.id}`
    });
  }

  if (!invoices.error || !isMissingSchemaError(invoices.error)) {
    for (const invoice of invoices.data || []) {
      results.push({
        id: invoice.id,
        type: 'invoice',
        title: invoice.invoice_number || `Invoice ${invoice.id.slice(0, 8)}`,
        subtitle: [invoice.customer_name, invoice.status].filter(Boolean).join(' · ') || null,
        href: `/invoices/${invoice.id}`
      });
    }
  }

  if (!contractors.error || !isMissingSchemaError(contractors.error)) {
    for (const worker of contractors.data || []) {
      results.push({
        id: worker.id,
        type: 'contractor',
        title: worker.name || 'Contractor',
        subtitle: [worker.email, worker.phone].filter(Boolean).join(' · ') || null,
        href: `/team?workerId=${worker.id}`
      });
    }
  }

  for (const t of tasks.error && isMissingSchemaError(tasks.error) ? [] : tasks.data || []) {
    results.push({
      id: t.id,
      type: 'task',
      title: t.title,
      subtitle: t.status,
      href: '/projects'
    });
  }
  for (const d of docs.error && isMissingSchemaError(docs.error) ? [] : docs.data || []) {
    results.push({
      id: d.id,
      type: 'document',
      title: d.title,
      subtitle: d.category,
      href: '/knowledge'
    });
  }
  for (const t of templates.error && isMissingSchemaError(templates.error) ? [] : templates.data || []) {
    results.push({
      id: t.id,
      type: 'template',
      title: t.title,
      subtitle: t.category,
      href: '/templates'
    });
  }
  for (const f of forms.error && isMissingSchemaError(forms.error) ? [] : forms.data || []) {
    results.push({
      id: f.id,
      type: 'form',
      title: f.name,
      subtitle: f.slug,
      href: `/forms/${f.id}`
    });
  }

  return NextResponse.json({ results: results.slice(0, 24) });
}
