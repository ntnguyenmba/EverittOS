'use client';

import { useEffect, useState } from 'react';
import { normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';

export type TeamOption = {
  userId: string;
  label: string;
  role: string;
};

type MemberRow = {
  user_id: string;
  role: string;
  active: boolean;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

function optionLabel(member: MemberRow, profile?: ProfileRow) {
  const name = profile?.full_name?.trim();
  const email = profile?.email?.trim();
  if (name && email) return `${name} (${email})`;
  return name || email || member.user_id;
}

export function useTeamOptions() {
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [teamOptionsLoading, setTeamOptionsLoading] = useState(true);

  useEffect(() => {
    async function loadTeamOptions() {
      setTeamOptionsLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        setTeamOptionsLoading(false);
        return;
      }

      const workspace = await ensureWorkspaceForSave(user.id);
      if (!workspace.ok) {
        setTeamOptionsLoading(false);
        return;
      }

      const { data: memberRows } = await supabase
        .from('organization_members')
        .select('user_id, role, active')
        .eq('organization_id', workspace.workspace.organizationId)
        .eq('active', true)
        .in('role', ['owner', 'admin', 'manager', 'employee', 'contractor'])
        .order('role');

      const members = (memberRows || []) as MemberRow[];
      const ids = members.map((member) => member.user_id);
      const { data: profileRows } = ids.length
        ? await supabase.from('profiles').select('id, email, full_name').in('id', ids)
        : { data: [] as ProfileRow[] };

      const profiles = new Map<string, ProfileRow>();
      for (const profile of (profileRows || []) as ProfileRow[]) profiles.set(profile.id, profile);

      setTeamOptions(
        members.map((member) => ({
          userId: member.user_id,
          role: normalizeRole(member.role),
          label: optionLabel(member, profiles.get(member.user_id))
        }))
      );
      setTeamOptionsLoading(false);
    }

    void loadTeamOptions();
  }, []);

  return { teamOptions, teamOptionsLoading };
}
