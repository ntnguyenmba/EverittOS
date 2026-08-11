'use client';

import { useCallback, useEffect, useState } from 'react';
import { isFeatureEnabled } from '@/lib/feature-flags';
import type { OrgMembership } from '@/lib/os-types';
import { roleDisplayName } from '@/lib/role-routes';
import { normalizeRole } from '@/lib/roles';

type SwitchOrganizationResponse = {
  destination?: string;
};

export function OrgSwitcher() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/org/memberships', { cache: 'no-store' });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json = await res.json();
    setMemberships(json.memberships || []);
    setActiveId(json.activeOrganizationId || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isFeatureEnabled('multiOrgSwitcher')) return;
    void load();
  }, [load]);

  async function switchOrg(organizationId: string) {
    if (organizationId === activeId || switching) return;
    setSwitching(true);

    const res = await fetch('/api/org/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId })
    });

    if (!res.ok) {
      setSwitching(false);
      return;
    }

    const json = (await res.json().catch(() => ({}))) as SwitchOrganizationResponse;
    setActiveId(organizationId);
    window.location.assign(json.destination || '/dashboard');
  }

  if (!isFeatureEnabled('multiOrgSwitcher')) return null;
  if (loading) return null;
  if (memberships.length <= 1) return null;

  return (
    <label className="org-switcher">
      <span className="org-switcher-label">Workspace</span>
      <select
        className="input org-switcher-select"
        value={activeId}
        disabled={switching}
        onChange={(event) => void switchOrg(event.target.value)}
        aria-label="Switch workspace"
      >
        {memberships.map((membership) => {
          const role = normalizeRole(membership.role);
          const roleName = role === 'contractor' ? 'Contractor' : roleDisplayName(role);
          return (
            <option key={membership.organizationId} value={membership.organizationId}>
              {membership.organizationName} · {roleName}
            </option>
          );
        })}
      </select>
    </label>
  );
}
