import { NextResponse } from 'next/server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canSeeOrgWideData } from '@/lib/permissions';
import type { SearchResultItem } from '@/lib/os-types';
import { customerDisplayName } from '@/lib/customer-record';
import { createServerSupabase } from '@/lib/supabase-server';
import { isMissingSchemaError } from '@/lib/supabase-schema-errors';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getResourceApiCopy } from '@/lib/i18n/resource-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const c = getResourceApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canSeeOrgWideData(org.role)) return NextResponse.json({ error: c.permissionDenied }, { status: 403 });

  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (q.length < 2) return NextResponse.json({ results: [] as SearchResultItem[] });
  const pattern = `%${q}%`; const orgId = org.organizationId;
  const [customers, properties, jobs, invoices, contractors, tasks, docs, templates, forms] = await Promise.all([
    supabase.from('customers').select('id, company_name, email, phone').eq('organization_id', orgId).or(`company_name.ilike."${pattern}",email.ilike."${pattern}",phone.ilike."${pattern}",address_line1.ilike."${pattern}",service_address.ilike."${pattern}"`).limit(8),
    supabase.from('customer_properties').select('id, customer_id, name, formatted_address, address, city, property_type').eq('organization_id', orgId).eq('is_archived', false).or(`name.ilike."${pattern}",formatted_address.ilike."${pattern}",address.ilike."${pattern}",city.ilike."${pattern}"`).limit(8),
    supabase.from('jobs').select('id, title, customer_name, address, phone').eq('organization_id', orgId).or(`title.ilike."${pattern}",customer_name.ilike."${pattern}",address.ilike."${pattern}",phone.ilike."${pattern}"`).limit(8),
    supabase.from('invoices').select('id, invoice_number, customer_name, status').eq('organization_id', orgId).or(`invoice_number.ilike."${pattern}",customer_name.ilike."${pattern}"`).limit(6),
    supabase.from('workers').select('id, name, phone, email').eq('organization_id', orgId).or(`name.ilike."${pattern}",phone.ilike."${pattern}",email.ilike."${pattern}"`).limit(6),
    supabase.from('os_tasks').select('id, title, status').eq('organization_id', orgId).ilike('title', pattern).limit(6),
    supabase.from('knowledge_documents').select('id, title, category').eq('organization_id', orgId).ilike('title', pattern).limit(6),
    supabase.from('template_library').select('id, title, category').eq('organization_id', orgId).ilike('title', pattern).limit(6),
    supabase.from('everitt_forms').select('id, name, slug').eq('organization_id', orgId).ilike('name', pattern).limit(6)
  ]);
  const results: SearchResultItem[] = [];
  for (const x of customers.data || []) results.push({id:x.id,type:'customer',title:customerDisplayName(x),subtitle:[x.email,x.phone].filter(Boolean).join(' · ')||null,href:`/customers/${x.id}`});
  if (!properties.error || !isMissingSchemaError(properties.error)) for (const x of properties.data || []) results.push({id:x.id,type:'property',title:x.name,subtitle:x.formatted_address||x.address||x.city||x.property_type||null,href:`/customers/${x.customer_id}?propertyId=${x.id}`});
  for (const x of jobs.data || []) results.push({id:x.id,type:'job',title:x.title,subtitle:[x.customer_name,x.address].filter(Boolean).join(' · ')||null,href:`/jobs/${x.id}`});
  if (!invoices.error || !isMissingSchemaError(invoices.error)) for (const x of invoices.data || []) results.push({id:x.id,type:'invoice',title:x.invoice_number||`${c.invoiceFallback} ${x.id.slice(0,8)}`,subtitle:[x.customer_name,x.status].filter(Boolean).join(' · ')||null,href:`/invoices/${x.id}`});
  if (!contractors.error || !isMissingSchemaError(contractors.error)) for (const x of contractors.data || []) results.push({id:x.id,type:'contractor',title:x.name||c.contractorFallback,subtitle:[x.email,x.phone].filter(Boolean).join(' · ')||null,href:`/team?workerId=${x.id}`});
  for (const x of tasks.error && isMissingSchemaError(tasks.error) ? [] : tasks.data || []) results.push({id:x.id,type:'task',title:x.title,subtitle:x.status,href:'/projects'});
  for (const x of docs.error && isMissingSchemaError(docs.error) ? [] : docs.data || []) results.push({id:x.id,type:'document',title:x.title,subtitle:x.category,href:'/knowledge'});
  for (const x of templates.error && isMissingSchemaError(templates.error) ? [] : templates.data || []) results.push({id:x.id,type:'template',title:x.title,subtitle:x.category,href:'/templates'});
  for (const x of forms.error && isMissingSchemaError(forms.error) ? [] : forms.data || []) results.push({id:x.id,type:'form',title:x.name,subtitle:x.slug,href:`/forms/${x.id}`});
  return NextResponse.json({ results: results.slice(0,24) });
}
