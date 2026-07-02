'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { CustomerMessagesPanel } from '@/components/customer-messages-panel';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { fetchOrganizationContext } from '@/lib/organization';
import { supabase } from '@/lib/supabase';

export default function MessagesPage() {
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const org = await fetchOrganizationContext(user.id);
      const workspaceRole = normalizeRole(org?.role || profile?.role);
      setPlan(normalizePlan(profile?.plan));
      setRole(workspaceRole);
      setCanManage(isManagerRole(workspaceRole));
    }
    void load();
  }, []);

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>Messages</h1>
        <p className="page-subtitle">
          Email-first customer messaging. Threads keep sent and failed delivery history in one place.
        </p>
      </header>

      <CustomerMessagesPanel canManage={canManage} />
    </AppShell>
  );
}
