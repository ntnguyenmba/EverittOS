'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { isAdminRole, isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';

/** Send each role to its own home. Owner is never the worker page. */
export function RoleHomeGuard() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const workspace = useWorkspacePlanOptional();
  const role = normalizeRole(workspace?.role);

  useEffect(() => {
    if (!workspace || workspace.loading || !workspace.role) return;

    const onContractor = pathname === '/portal/contractor' || pathname.startsWith('/portal/contractor/');
    const onClient = pathname === '/portal/client' || pathname.startsWith('/portal/client/');
    const onOwnerHome = pathname === '/dashboard' || pathname === '/';

    if (isAdminRole(role) && onContractor) {
      router.replace('/dashboard');
      return;
    }
    if (isAdminRole(role) && onClient) {
      router.replace('/dashboard');
      return;
    }
    if (isContractorRole(role) && onOwnerHome) {
      router.replace(dashboardPathForRole(role));
      return;
    }
    if (isClientRole(role) && onOwnerHome) {
      router.replace(dashboardPathForRole(role));
    }
  }, [pathname, role, router, workspace]);

  return null;
}
