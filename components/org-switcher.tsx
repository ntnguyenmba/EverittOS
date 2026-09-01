'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import type { OrgMembership } from '@/lib/os-types';
import { roleDisplayName } from '@/lib/role-routes';
import { normalizeRole } from '@/lib/roles';

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
    const res = await fetch('/api/org/memberships', { cache: 'no-store', credentials: 'same-origin' });
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

  function switchOrg(organizationId: string) {
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
    setActiveId(organizationId);
    // Make the workspace cookie change and role-aware redirect one server
    // navigation. This prevents portal middleware from seeing the old worker or
    // client workspace between the switch response and the next page request.
    window.location.assign(`/api/org/switch?organizationId=${encodeURIComponent(organizationId)}`);
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
        onChange={(event) => switchOrg(event.target.value)}
        aria-label={copy.switchLabel}
      >
        {memberships.map((membership) => {
          const role = membership.isOwner ? 'owner' : normalizeRole(membership.role);
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
