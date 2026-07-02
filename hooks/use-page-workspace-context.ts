'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspacePlan } from '@/hooks/use-workspace-plan';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';

type PageWorkspaceContext = {
  plan: EverittosPlan;
  role: UserRole;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Workspace plan + role for authenticated app pages.
 * Uses organization owner plan (same source as billing page).
 */
export function usePageWorkspaceContext(loginNext?: string): PageWorkspaceContext {
  const router = useRouter();
  const { plan, role, loading, error, refresh } = useWorkspacePlan();

  useEffect(() => {
    if (loading || error) return;
    if (!plan) {
      router.push(loginNext ? `/login?next=${encodeURIComponent(loginNext)}` : '/login');
    }
  }, [loading, plan, error, router, loginNext]);

  return {
    plan: plan ?? 'free',
    role: role ?? normalizeRole('owner'),
    loading,
    error,
    refresh
  };
}
