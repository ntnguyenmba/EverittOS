'use client';

import { AppShell } from '@/components/app-shell';
import { TeamManagementPanel } from '@/components/team/team-management-panel';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TeamPage() {
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
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const org = await fetchOrganizationContext(user.id);
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(org?.role || profile?.role));
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <AppShell plan={plan} role={role}>
        <p className="loading-state">Loading people...</p>
      </AppShell>
    );
  }

  return (
    <AppShell plan={plan} role={role}>
      <h1>People</h1>
      <p className="muted">Invite people, manage roles, control access, and review who can work in this workspace.</p>
      <TeamManagementPanel showPermissionMatrix showAuditHistory={false} />
    </AppShell>
  );
}
