'use client';

import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { TeamManagementPanel } from '@/components/team/team-management-panel';
import { EverittteamAiUsagePanel } from '@/components/team/everittteam-ai-usage-panel';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SettingsTeamPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/team');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <AppShell plan={plan} role={role}>
        <p>Loading team settings...</p>
      </AppShell>
    );
  }

  return (
    <SettingsShell
      plan={plan}
      role={role}
      title="Team"
      description="Invite members, manage roles, and review team audit history."
    >
      <EverittteamAiUsagePanel />
      <TeamManagementPanel showPermissionMatrix showAuditHistory />
    </SettingsShell>
  );
}
