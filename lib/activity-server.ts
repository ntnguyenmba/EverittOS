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

export async function logActivityServer(_input: LogActivityInput): Promise<void> {
  return;
}

export async function logWorkspaceActivity(
  _organizationId: string,
  _userId: string,
  _entityType: string,
  _entityId: string | null,
  _action: ActivityEventType | string,
  _message: string,
  _metadata?: Record<string, unknown>
): Promise<void> {
  return;
}

export const ACTIVITY_EVENT_LABELS: Record<string, string> = {};
