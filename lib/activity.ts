import { supabase } from '@/lib/supabase';

export type ActivityAction =
  | 'job_created'
  | 'job_edited'
  | 'customer_created'
  | 'worker_assigned'
  | 'worker_removed'
  | 'photo_uploaded'
  | 'report_generated'
  | 'status_changed'
  | 'schedule_changed';

export async function logClientActivity(
  organizationId: string,
  entityType: string,
  entityId: string | null,
  action: ActivityAction,
  message: string,
  metadata?: Record<string, unknown>
) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('activity_logs').insert({
    organization_id: organizationId,
    user_id: user.id,
    entity_type: entityType,
    entity_id: entityId,
    action,
    message,
    metadata: metadata || {}
  });
}

export async function createNotification(
  organizationId: string,
  userId: string,
  type: 'assignment' | 'due_date' | 'completion' | 'report',
  title: string,
  body: string,
  relatedJobId?: string
) {
  await supabase.from('notifications').insert({
    organization_id: organizationId,
    user_id: userId,
    type,
    title,
    body,
    related_job_id: relatedJobId || null
  });
}
