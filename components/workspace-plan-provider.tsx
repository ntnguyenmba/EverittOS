'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

export type WorkspacePlanState = {
  /** Normalized plan from the signed-in user's profiles.plan row. */
  profilePlan: EverittosPlan | null;
  /** Raw profiles.subscription_status from Supabase. */
  subscriptionStatus: string | null;
  /** Same as profilePlan — billing UI reads profiles.plan directly. */
  billingPlan: EverittosPlan | null;
  /** Organization owner's profiles.plan (limits + feature gates). */
  organizationPlan: EverittosPlan | null;
  /** Effective plan for UI: organization plan when present, else profile plan. */
  plan: EverittosPlan | null;
  role: UserRole | null;
  rawProfilePlan: string | null;
  rawSubscriptionStatus: string | null;
  loading: boolean;
  error: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
};

const WorkspacePlanContext = createContext<WorkspacePlanState | null>(null);

type WorkspacePlanResponse = {
  profilePlan?: string;
  subscriptionStatus?: string;
  billingPlan?: string;
  organizationPlan?: string;
  role?: string;
  rawProfilePlan?: string | null;
  rawSubscriptionStatus?: string | null;
  error?: string;
};

async function fetchWorkspacePlan(): Promise<Omit<WorkspacePlanState, 'refresh'>> {
  const res = await fetch('/api/workspace/plan', { cache: 'no-store' });
  if (res.status === 401) {
    return {
      profilePlan: null,
      subscriptionStatus: null,
      billingPlan: null,
      organizationPlan: null,
      plan: null,
      role: null,
      rawProfilePlan: null,
      rawSubscriptionStatus: null,
      loading: false,
      error: null
    };
  }

  const json = (await res.json()) as WorkspacePlanResponse;
  if (!res.ok) {
    return {
      profilePlan: null,
      subscriptionStatus: null,
      billingPlan: null,
      organizationPlan: null,
      plan: null,
      role: null,
      rawProfilePlan: null,
      rawSubscriptionStatus: null,
      loading: false,
      error: json.error || 'Unable to load workspace plan.'
    };
  }

  const profilePlan = json.profilePlan ? normalizePlan(json.profilePlan) : null;
  const billingPlan = json.billingPlan ? normalizePlan(json.billingPlan) : profilePlan;
  const organizationPlan = json.organizationPlan
    ? normalizePlan(json.organizationPlan)
    : profilePlan;
  const effectivePlan = organizationPlan ?? profilePlan;

  return {
    profilePlan,
    subscriptionStatus: json.subscriptionStatus ?? json.rawSubscriptionStatus ?? null,
    billingPlan,
    organizationPlan,
    plan: effectivePlan,
    role: normalizeRole(json.role || 'owner'),
    rawProfilePlan: json.rawProfilePlan ?? json.profilePlan ?? null,
    rawSubscriptionStatus: json.rawSubscriptionStatus ?? json.subscriptionStatus ?? null,
    loading: false,
    error: null
  };
}

export function WorkspacePlanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<WorkspacePlanState, 'refresh'>>({
    profilePlan: null,
    subscriptionStatus: null,
    billingPlan: null,
    organizationPlan: null,
    plan: null,
    role: null,
    rawProfilePlan: null,
    rawSubscriptionStatus: null,
    loading: true,
    error: null
  });

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    setState((prev) => ({
      ...prev,
      loading: options?.silent ? prev.loading : true,
      error: null
    }));
    const next = await fetchWorkspacePlan();
    setState(next);
  }, []);

  useEffect(() => {
    void refresh();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        void refresh();
      }
    });

    const onNativeResume = () => {
      void refresh({ silent: true });
    };
    window.addEventListener('everittos:workspace-plan-refresh', onNativeResume);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('everittos:workspace-plan-refresh', onNativeResume);
    };
  }, [refresh]);

  const value = useMemo<WorkspacePlanState>(() => ({ ...state, refresh }), [state, refresh]);

  return <WorkspacePlanContext.Provider value={value}>{children}</WorkspacePlanContext.Provider>;
}

export function useWorkspacePlan(): WorkspacePlanState {
  const ctx = useContext(WorkspacePlanContext);
  if (!ctx) {
    throw new Error('useWorkspacePlan must be used within WorkspacePlanProvider');
  }
  return ctx;
}

/** Safe variant for components that may render outside the provider (e.g. marketing pages). */
export function useWorkspacePlanOptional(): WorkspacePlanState | null {
  return useContext(WorkspacePlanContext);
}
