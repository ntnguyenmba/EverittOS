import { NextResponse } from 'next/server';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canSeeOrgWideData } from '@/lib/permissions';
import type { SearchResultItem } from '@/lib/os-types';
import { createServerSupabase } from '@/lib/supabase-server';

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

  const [customers, jobs, tasks, docs, templates, forms] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, email')
      .eq('organization_id', orgId)
      .or(`name.ilike."${pattern}",email.ilike."${pattern}"`)
      .limit(8),
    supabase
      .from('jobs')
      .select('id, title, customer_name')
      .eq('organization_id', orgId)
      .or(`title.ilike."${pattern}",customer_name.ilike."${pattern}"`)
      .limit(8),
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
      title: c.name,
      subtitle: c.email,
      href: `/customers/${c.id}`
    });
  }
  for (const j of jobs.data || []) {
    results.push({
      id: j.id,
      type: 'job',
      title: j.title,
      subtitle: j.customer_name,
      href: `/jobs/${j.id}`
    });
  }
  for (const t of tasks.data || []) {
    results.push({
      id: t.id,
      type: 'task',
      title: t.title,
      subtitle: t.status,
      href: '/projects'
    });
  }
  for (const d of docs.data || []) {
    results.push({
      id: d.id,
      type: 'document',
      title: d.title,
      subtitle: d.category,
      href: '/knowledge'
    });
  }
  for (const t of templates.data || []) {
    results.push({
      id: t.id,
      type: 'template',
      title: t.title,
      subtitle: t.category,
      href: '/templates'
    });
  }
  for (const f of forms.data || []) {
    results.push({
      id: f.id,
      type: 'form',
      title: f.name,
      subtitle: f.slug,
      href: `/forms/${f.id}`
    });
  }

  return NextResponse.json({ results: results.slice(0, 20) });
}
