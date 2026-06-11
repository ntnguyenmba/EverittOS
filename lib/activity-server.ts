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
  | 'job_created'
  | 'job_edited'
  | 'job_updated'
  | 'job_assigned'
  | 'customer_created'
  | 'worker_assigned'
  | 'worker_removed'
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

export const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  login: 'Sign in',
  logout: 'Sign out',
  invite_sent: 'Invitation sent',
  invite_accepted: 'Invitation accepted',
  user_created: 'User created',
  user_updated: 'User updated',
  role_changed: 'Role changed',
  job_created: 'Job created',
  job_assigned: 'Job assigned',
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
  schedule_changed: 'Schedule changed'
};
