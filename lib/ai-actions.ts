import type { SupabaseClient } from '@supabase/supabase-js';
import { logActivityServer } from '@/lib/activity-server';
import { canManageOrganizationSettings, normalizeRole, type UserRole } from '@/lib/roles';

export type AiActionType =
  | 'create_lead'
  | 'create_contact'
  | 'create_task'
  | 'create_proposal'
  | 'draft_email';

export type ProposedAiAction = {
  type: AiActionType;
  label: string;
  params: Record<string, string>;
};

const ACTION_BLOCK_RE = /```action\s*([\s\S]*?)```/i;

export function parseProposedAction(reply: string): { cleanReply: string; action: ProposedAiAction | null } {
  const match = reply.match(ACTION_BLOCK_RE);
  if (!match) return { cleanReply: reply.trim(), action: null };

  try {
    const parsed = JSON.parse(match[1].trim()) as ProposedAiAction;
    if (!parsed.type || !parsed.label) {
      return { cleanReply: reply.replace(ACTION_BLOCK_RE, '').trim(), action: null };
    }
    const cleanReply = reply.replace(ACTION_BLOCK_RE, '').trim();
    return { cleanReply, action: { ...parsed, params: parsed.params || {} } };
  } catch {
    return { cleanReply: reply.replace(ACTION_BLOCK_RE, '').trim(), action: null };
  }
}

export const AI_ACTION_SYSTEM_HINT = `
When the user asks you to create something (lead, contact, task, proposal, email draft), respond with a helpful summary then include a single action block the app can confirm:

\`\`\`action
{"type":"create_lead","label":"Create lead: Acme Corp","params":{"name":"Acme Corp","email":"info@acme.com","notes":"From website"}}
\`\`\`

Allowed types: create_lead, create_contact, create_task, create_proposal, draft_email.
For draft_email, put the email body in params.body and subject in params.subject.
Never execute actions yourself — only propose them in the action block.
`.trim();

export type ExecuteActionResult =
  | { ok: true; message: string; entityType: string; entityId: string | null }
  | { ok: false; message: string };

export async function executeAiAction(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    role: UserRole;
    action: ProposedAiAction;
  }
): Promise<ExecuteActionResult> {
  if (!canManageOrganizationSettings(normalizeRole(input.role))) {
    return { ok: false, message: 'Your role cannot execute AI actions.' };
  }

  const { type, params } = input.action;
  const orgId = input.organizationId;

  switch (type) {
    case 'create_lead':
    case 'create_contact': {
      const name = (params.name || params.company || '').trim();
      if (!name) return { ok: false, message: 'Name is required for this action.' };
      const { data, error } = await admin
        .from('customers')
        .insert({
          organization_id: orgId,
          name,
          email: params.email?.trim() || null,
          phone: params.phone?.trim() || null,
          notes: params.notes?.trim() || null,
          record_type: type === 'create_lead' ? 'lead' : 'contact',
          pipeline_stage: type === 'create_lead' ? 'lead' : 'won',
          lead_source: 'manual'
        })
        .select('id')
        .single();
      if (error) return { ok: false, message: error.message };
      await logActivityServer({
        organizationId: orgId,
        userId: input.userId,
        entityType: 'customer',
        entityId: data.id,
        action: 'ai_action_executed',
        message: `AI created ${type === 'create_lead' ? 'lead' : 'contact'}: ${name}`,
        metadata: { ai_action: type }
      });
      return {
        ok: true,
        message: `${type === 'create_lead' ? 'Lead' : 'Contact'} created: ${name}`,
        entityType: 'customer',
        entityId: data.id
      };
    }
    case 'create_task': {
      const title = (params.title || params.name || '').trim();
      if (!title) return { ok: false, message: 'Task title is required.' };
      const { data, error } = await admin
        .from('os_tasks')
        .insert({
          organization_id: orgId,
          title,
          description: params.description?.trim() || null,
          created_by: input.userId
        })
        .select('id')
        .single();
      if (error) return { ok: false, message: error.message };
      await logActivityServer({
        organizationId: orgId,
        userId: input.userId,
        entityType: 'task',
        entityId: data.id,
        action: 'ai_action_executed',
        message: `AI created task: ${title}`,
        metadata: { ai_action: type }
      });
      return { ok: true, message: `Task created: ${title}`, entityType: 'task', entityId: data.id };
    }
    case 'create_proposal': {
      const title = (params.title || 'New proposal').trim();
      const amount = params.amount ? Number(params.amount) : null;
      const { data, error } = await admin
        .from('proposals')
        .insert({
          organization_id: orgId,
          title,
          body: params.body?.trim() || '',
          amount: Number.isFinite(amount) ? amount : null,
          status: 'draft',
          created_by: input.userId
        })
        .select('id')
        .single();
      if (error) return { ok: false, message: error.message };
      await logActivityServer({
        organizationId: orgId,
        userId: input.userId,
        entityType: 'proposal',
        entityId: data.id,
        action: 'ai_action_executed',
        message: `AI created proposal: ${title}`,
        metadata: { ai_action: type }
      });
      return { ok: true, message: `Proposal draft created: ${title}`, entityType: 'proposal', entityId: data.id };
    }
    case 'draft_email': {
      await logActivityServer({
        organizationId: orgId,
        userId: input.userId,
        entityType: 'email',
        entityId: null,
        action: 'ai_action_executed',
        message: 'AI email draft saved to activity log',
        metadata: { ai_action: type, subject: params.subject || '' }
      });
      return {
        ok: true,
        message: 'Email draft ready — copy from the conversation.',
        entityType: 'email',
        entityId: null
      };
    }
    default:
      return { ok: false, message: 'Unsupported action type.' };
  }
}
