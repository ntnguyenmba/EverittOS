'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import type { OrgMembership } from '@/lib/os-types';

export function OrgSwitcher() {
  const router = useRouter();
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
    setSwitching(false);
    if (!res.ok) return;
    setActiveId(organizationId);
    router.refresh();
    window.location.reload();
  }

  if (!isFeatureEnabled('multiOrgSwitcher')) return null;
  if (loading) return null;
  if (memberships.length <= 1) return null;

  return (
    <label className="org-switcher">
      <span className="org-switcher-label">Company</span>
      <select
        className="input org-switcher-select"
        value={activeId}
        disabled={switching}
        onChange={(e) => void switchOrg(e.target.value)}
        aria-label="Switch organization"
      >
        {memberships.map((m) => (
          <option key={m.organizationId} value={m.organizationId}>
            {m.organizationName}
          </option>
        ))}
      </select>
    </label>
  );
}
