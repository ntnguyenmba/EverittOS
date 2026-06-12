import type { SupabaseClient } from '@supabase/supabase-js';
import { customerDisplayName } from '@/lib/customer-record';

function tomorrowRange(): { start: string; end: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const start = d.toISOString().slice(0, 10);
  return { start, end: start };
}

function monthStartIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Build live organization context for AI retrieval (no mock data). */
export async function buildOrganizationAiContext(
  admin: SupabaseClient,
  organizationId: string
): Promise<string> {
  const { start: tomorrow } = tomorrowRange();
  const monthStart = monthStartIso();

  const [
    memoryRes,
    jobsTomorrowRes,
    openJobsRes,
    leadsRes,
    proposalsRes,
    tasksRes,
    knowledgeRes,
    templatesRes,
    teamRes
  ] = await Promise.all([
    admin
      .from('organization_ai_memory')
      .select('company_profile, services, team_notes, service_areas, pricing_rules, brand_voice')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    admin
      .from('jobs')
      .select('title, customer_name, scheduled_date, status')
      .eq('organization_id', organizationId)
      .eq('scheduled_date', tomorrow)
      .limit(15),
    admin
      .from('jobs')
      .select('title, customer_name, status')
      .eq('organization_id', organizationId)
      .in('status', ['open', 'scheduled', 'in_progress', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(12),
    admin
      .from('customers')
      .select('company_name, pipeline_stage, lead_source, record_type, created_at')
      .eq('organization_id', organizationId)
      .eq('record_type', 'lead')
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('proposals')
      .select('title, status, amount, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(15),
    admin
      .from('os_tasks')
      .select('title, status, due_date')
      .eq('organization_id', organizationId)
      .eq('status', 'open')
      .limit(12),
    admin
      .from('knowledge_documents')
      .select('title, category')
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false })
      .limit(15),
    admin
      .from('template_library')
      .select('title, category')
      .eq('organization_id', organizationId)
      .limit(10),
    admin
      .from('organization_members')
      .select('role, profiles(full_name, email)')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .limit(20)
  ]);

  const memory = memoryRes.data;
  const sections: string[] = [];

  if (memory) {
    const memParts = [
      memory.company_profile,
      memory.services ? `Services: ${memory.services}` : null,
      memory.service_areas ? `Service areas: ${memory.service_areas}` : null,
      memory.pricing_rules ? `Pricing: ${memory.pricing_rules}` : null,
      memory.brand_voice ? `Brand voice: ${memory.brand_voice}` : null,
      memory.team_notes ? `Team notes: ${memory.team_notes}` : null
    ].filter(Boolean);
    if (memParts.length) sections.push(`Company memory:\n${memParts.join('\n')}`);
  }

  const jobsTomorrow = jobsTomorrowRes.data || [];
  if (jobsTomorrow.length) {
    sections.push(
      `Jobs scheduled tomorrow (${tomorrow}):\n${jobsTomorrow.map((j) => `- ${j.title} (${j.customer_name || 'no customer'}) [${j.status}]`).join('\n')}`
    );
  } else {
    sections.push(`Jobs scheduled tomorrow (${tomorrow}): none`);
  }

  const openJobs = openJobsRes.data || [];
  if (openJobs.length) {
    sections.push(
      `Open/active jobs:\n${openJobs.map((j) => `- ${j.title} (${j.customer_name || 'n/a'}) [${j.status}]`).join('\n')}`
    );
  }

  const leads = leadsRes.data || [];
  if (leads.length) {
    sections.push(
      `Leads this month:\n${leads.map((l) => `- ${customerDisplayName(l)} [${l.pipeline_stage}] source=${l.lead_source}`).join('\n')}`
    );
  } else {
    sections.push('Leads this month: none');
  }

  const proposals = proposalsRes.data || [];
  const pending = proposals.filter((p) => p.status === 'draft' || p.status === 'sent');
  if (proposals.length) {
    sections.push(
      `Proposals:\n${proposals.map((p) => `- ${p.title} [$${p.amount ?? 'n/a'}] status=${p.status}`).join('\n')}`
    );
  }
  if (pending.length) {
    sections.push(`Proposals awaiting action: ${pending.map((p) => p.title).join(', ')}`);
  }

  const tasks = tasksRes.data || [];
  if (tasks.length) {
    sections.push(`Open tasks:\n${tasks.map((t) => `- ${t.title}${t.due_date ? ` due ${t.due_date}` : ''}`).join('\n')}`);
  }

  const docs = knowledgeRes.data || [];
  if (docs.length) {
    sections.push(
      `Knowledge vault:\n${docs.map((d) => `- ${d.title} (${d.category})`).join('\n')}`
    );
  }

  const templates = templatesRes.data || [];
  if (templates.length) {
    sections.push(
      `Templates:\n${templates.map((t) => `- ${t.title} (${t.category})`).join('\n')}`
    );
  }

  const team = teamRes.data || [];
  if (team.length) {
    sections.push(
      `Team (${team.length} members):\n${team
        .map((m) => {
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          const name = (p as { full_name?: string; email?: string } | null)?.full_name || (p as { email?: string } | null)?.email || 'Member';
          return `- ${name} (${m.role})`;
        })
        .join('\n')}`
    );
  }

  return sections.join('\n\n');
}
