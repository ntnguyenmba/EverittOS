import type { SupabaseClient } from '@supabase/supabase-js';
import { logWorkspaceActivity } from '@/lib/activity-server';
import { notifyUsers } from '@/lib/notifications-server';
import { assertActiveOrgMember, assertTeamInOrg, listTeamMemberUserIds } from '@/lib/teams-server';

export async function validateJobAssignee(
  admin: SupabaseClient,
  organizationId: string,
  userId: string | null | undefined
): Promise<string | null> {
  if (!userId) return null;
  const ok = await assertActiveOrgMember(admin, organizationId, userId);
  if (!ok) throw new Error('Assignee must be an active workspace member.');
  return userId;
}

export async function validateJobTeam(
  admin: SupabaseClient,
  organizationId: string,
  teamId: string | null | undefined
): Promise<string | null> {
  if (!teamId) return null;
  const team = await assertTeamInOrg(admin, organizationId, teamId);
  if (!team || !team.active) throw new Error('Team must belong to this workspace and be active.');
  return teamId;
}

export async function handleJobAssignmentChange(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    actorUserId: string;
    jobId: string;
    jobTitle: string;
    previousAssigneeId?: string | null;
    newAssigneeId?: string | null;
    previousTeamId?: string | null;
    newTeamId?: string | null;
  }
): Promise<void> {
  const { organizationId, actorUserId, jobId, jobTitle } = input;

  if (input.newAssigneeId && input.newAssigneeId !== input.previousAssigneeId) {
    await logWorkspaceActivity(
      organizationId,
      actorUserId,
      'job',
      jobId,
      'job_assigned',
      `Job assigned to teammate: ${jobTitle}`,
      { assigned_user_id: input.newAssigneeId }
    );
    if (input.newAssigneeId !== actorUserId) {
      await notifyUsers([input.newAssigneeId], {
        organizationId,
        type: 'assignment',
        title: 'Job assigned to you',
        body: jobTitle,
        relatedJobId: jobId
      });
    }
  }

  if (input.newTeamId && input.newTeamId !== input.previousTeamId) {
    await logWorkspaceActivity(
      organizationId,
      actorUserId,
      'job',
      jobId,
      'job_team_assigned',
      `Job assigned to team: ${jobTitle}`,
      { team_id: input.newTeamId }
    );
    const memberIds = await listTeamMemberUserIds(admin, input.newTeamId);
    const notifyIds = memberIds.filter((id) => id !== actorUserId);
    if (notifyIds.length) {
      await notifyUsers(notifyIds, {
        organizationId,
        type: 'assignment',
        title: 'Team job assignment',
        body: jobTitle,
        relatedJobId: jobId
      });
    }
  }
}
