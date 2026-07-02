import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabase } from '@/lib/supabase-admin';

export type NotificationType =
  | 'assignment'
  | 'due_date'
  | 'completion'
  | 'report'
  | 'shared'
  | 'invite'
  | 'portal_message'
  | 'approval';

export async function createWorkspaceNotification(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    relatedJobId?: string | null;
  }
): Promise<void> {
  const dbType =
    input.type === 'shared' || input.type === 'portal_message' || input.type === 'approval' || input.type === 'invite'
      ? 'report'
      : input.type === 'assignment'
        ? 'assignment'
        : input.type;

  const { error } = await admin.from('notifications').insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    type: dbType,
    title: input.title,
    body: input.body || null,
    related_job_id: input.relatedJobId || null
  });
  if (error) {
    console.warn('[notifications] insert failed', error.message);
  }
}

export async function notifyUsers(
  userIds: string[],
  input: Omit<Parameters<typeof createWorkspaceNotification>[1], 'userId'>
): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  await Promise.all(
    unique.map((userId) =>
      createWorkspaceNotification(admin, {
        ...input,
        userId
      })
    )
  );
}
