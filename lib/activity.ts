import { supabase } from '@/lib/supabase';

export type ActivityAction =
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
  | 'user_removed'
  | 'subscription_changed';

export async function logClientActivity(
  organizationId: string,
  entityType: string,
  entityId: string | null,
  action: ActivityAction | string,
  message: string,
  metadata?: Record<string, unknown>
) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase.from('profiles').select('business_name').eq('id', user.id).maybeSingle();
  const actorName = profile?.business_name?.trim() || 'Team member';

  await supabase.from('activity_logs').insert({
    organization_id: organizationId,
    user_id: user.id,
    actor_name: actorName,
    entity_type: entityType,
    entity_id: entityId,
    action,
    message,
    metadata: metadata || {}
  });
}

export type NotificationType =
  | 'assignment'
  | 'due_date'
  | 'completion'
  | 'report'
  | 'invite'
  | 'subscription'
  | 'organization';

export async function createNotification(
  organizationId: string,
  userId: string,
  type: NotificationType,
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
