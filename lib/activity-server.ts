import { createAdminSupabase } from '@/lib/supabase-admin';

export type ActivityEventType =
  | 'login'
  | 'logout'
  | 'invite_sent'
  | 'invite_accepted'
  | 'user_created'
  | 'user_updated'
  | 'role_changed'
  | 'job_created'
  | 'job_assigned'
  | 'report_uploaded'
  | 'report_viewed'
  | 'invoice_created'
  | 'invoice_paid'
  | 'subscription_changed'
  | 'job_edited'
  | 'job_updated'
  | 'customer_created'
  | 'customer_updated'
  | 'customer_deleted'
  | 'worker_created'
  | 'worker_updated'
  | 'worker_deleted'
  | 'worker_assigned'
  | 'worker_removed'
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'job_deleted'
  | 'photo_uploaded'
  | 'report_generated'
  | 'report_submitted'
  | 'status_changed'
  | 'schedule_changed'
  | 'user_invited'
  | 'user_removed';

export type LogActivityInput = {
  organizationId: string;
  userId?: string | null;
  actorName?: string | null;
  entityType: string;
  entityId?: string | null;
  action: ActivityEventType | string;
  message: string;
  metadata?: Record<string, unknown>;
};

export async function logActivityServer(input: LogActivityInput): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;

  await admin.from('activity_logs').insert({
    organization_id: input.organizationId,
    user_id: input.userId || null,
    actor_name: input.actorName || 'System',
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    action: input.action,
    message: input.message,
    metadata: input.metadata || {}
  });
}

export async function logWorkspaceActivity(
  organizationId: string,
  userId: string,
  entityType: string,
  entityId: string | null,
  action: ActivityEventType | string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;

  const { data: profile } = await admin
    .from('profiles')
    .select('business_name')
    .eq('id', userId)
    .maybeSingle();

  await logActivityServer({
    organizationId,
    userId,
    actorName: profile?.business_name?.trim() || 'Team member',
    entityType,
    entityId,
    action,
    message,
    metadata
  });
}

export const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  login: 'Sign in',
  logout: 'Sign out',
  invite_sent: 'Invitation sent',
  invite_accepted: 'Invitation accepted',
  user_created: 'User created',
  user_updated: 'User updated',
  role_changed: 'Role changed',
  job_created: 'Job created',
  job_updated: 'Job updated',
  job_deleted: 'Job deleted',
  job_assigned: 'Job assigned',
  customer_created: 'Customer created',
  customer_updated: 'Customer updated',
  customer_deleted: 'Customer deleted',
  worker_created: 'Worker created',
  worker_updated: 'Worker updated',
  worker_deleted: 'Worker deleted',
  expense_created: 'Expense created',
  expense_updated: 'Expense updated',
  expense_deleted: 'Expense deleted',
  report_uploaded: 'Report uploaded',
  report_viewed: 'Report viewed',
  invoice_created: 'Invoice created',
  invoice_paid: 'Invoice paid',
  subscription_changed: 'Subscription changed',
  user_invited: 'User invited',
  user_removed: 'User removed',
  photo_uploaded: 'Photo uploaded',
  report_generated: 'Report generated',
  status_changed: 'Status changed',
  schedule_changed: 'Schedule changed',
  org_switched: 'Workspace switched',
  form_created: 'Form created',
  form_updated: 'Form updated',
  form_deleted: 'Form deleted',
  lead_created: 'Lead created',
  template_created: 'Template created',
  template_updated: 'Template updated',
  template_deleted: 'Template deleted',
  template_duplicated: 'Template duplicated',
  review_request_created: 'Review request created',
  review_request_updated: 'Review request updated',
  review_request_deleted: 'Review request removed',
  review_submitted: 'Review submitted',
  ai_action_executed: 'AI action executed'
};
