'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import type { OrgMembership } from '@/lib/os-types';
import { roleDisplayName } from '@/lib/role-routes';
import { normalizeRole } from '@/lib/roles';

type SwitchOrganizationResponse = {
  destination?: string;
};

export function OrgSwitcher() {
  const pathname = usePathname() || '';
  const { locale } = useTranslation();
  const copy = locale === 'es'
    ? { view: 'Vista', create: 'Crear su propia empresa', switchLabel: 'Cambiar vista' }
    : locale === 'vi'
      ? { view: 'Chế độ xem', create: 'Tạo công ty riêng', switchLabel: 'Đổi chế độ xem' }
      : { view: 'View', create: 'Create your own company', switchLabel: 'Change view' };
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
    void load();
  }, [load]);

  async function switchOrg(organizationId: string) {
    if (organizationId === '__create_company__') {
      const settingsPath = pathname.startsWith('/portal/contractor')
        ? '/portal/contractor/settings#create-company'
        : pathname.startsWith('/portal/client')
          ? '/portal/client/settings#create-company'
          : '/settings/account#create-company';
      window.location.assign(settingsPath);
      return;
    }
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

  if (loading || memberships.length === 0) return null;
  const hasOwnedCompany = memberships.some((membership) => membership.isOwner);

  return (
    <label className="org-switcher">
      <span className="org-switcher-label">{copy.view}</span>
      <select
        className="input org-switcher-select"
        value={activeId}
        disabled={switching}
        onChange={(event) => void switchOrg(event.target.value)}
        aria-label={copy.switchLabel}
      >
        {memberships.map((membership) => {
          const role = normalizeRole(membership.role);
          const roleName = role === 'contractor'
            ? locale === 'es' ? 'Trabajador' : locale === 'vi' ? 'Nhân viên' : 'Worker'
            : role === 'client'
              ? locale === 'es' ? 'Cliente' : locale === 'vi' ? 'Khách hàng' : 'Client'
              : roleDisplayName(role);
          return (
            <option key={membership.organizationId} value={membership.organizationId}>
              {membership.organizationName} · {roleName}
            </option>
          );
        })}
        {!hasOwnedCompany ? <option value="__create_company__">+ {copy.create}</option> : null}
      </select>
    </label>
  );
}
