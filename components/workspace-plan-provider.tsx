'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

export type WorkspacePlanState = {
  profilePlan: EverittosPlan | null;
  subscriptionStatus: string | null;
  billingPlan: EverittosPlan | null;
  organizationPlan: EverittosPlan | null;
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

function emptyPlanState(error: string | null = null): Omit<WorkspacePlanState, 'refresh'> {
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
    error
  };
}

async function requestWorkspacePlan(): Promise<Response> {
  return fetch('/api/workspace/plan', {
    cache: 'no-store',
    credentials: 'same-origin'
  });
}

async function fetchWorkspacePlan(): Promise<Omit<WorkspacePlanState, 'refresh'>> {
  let res = await requestWorkspacePlan();
  if (res.status === 401) return emptyPlanState();

  let json = (await res.json().catch(() => ({}))) as WorkspacePlanResponse;
  if (!res.ok) return emptyPlanState(json.error || 'Unable to load workspace plan.');

  const firstPlan = normalizePlan(json.organizationPlan || json.billingPlan || json.profilePlan || 'free');

  // Recover Stripe subscriptions that were paid successfully but were not saved by an older webhook.
  // The endpoint verifies directly with Stripe and never trusts a client-supplied plan.
  if (firstPlan === 'free') {
    const recovery = await fetch('/api/stripe/sync-current-user', {
      method: 'POST',
      credentials: 'same-origin'
    }).catch(() => null);

    if (recovery?.ok) {
      res = await requestWorkspacePlan();
      json = (await res.json().catch(() => ({}))) as WorkspacePlanResponse;
      if (!res.ok) return emptyPlanState(json.error || 'Unable to refresh workspace plan.');
    }
  }

  const profilePlan = json.profilePlan ? normalizePlan(json.profilePlan) : null;
  const billingPlan = json.billingPlan ? normalizePlan(json.billingPlan) : profilePlan;
  const organizationPlan = json.organizationPlan ? normalizePlan(json.organizationPlan) : profilePlan;

  return {
    profilePlan,
    subscriptionStatus: json.subscriptionStatus ?? json.rawSubscriptionStatus ?? null,
    billingPlan,
    organizationPlan,
    plan: organizationPlan ?? profilePlan,
    role: normalizeRole(json.role || 'owner'),
    rawProfilePlan: json.rawProfilePlan ?? json.profilePlan ?? null,
    rawSubscriptionStatus: json.rawSubscriptionStatus ?? json.subscriptionStatus ?? null,
    loading: false,
    error: null
  };
}

export function WorkspacePlanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<WorkspacePlanState, 'refresh'>>({
    ...emptyPlanState(),
    loading: true
  });
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const run = (async () => {
      setState((prev) => ({
        ...prev,
        loading: options?.silent ? prev.loading : true,
        error: null
      }));
      const next = await fetchWorkspacePlan();
      setState(next);
    })();

    refreshPromiseRef.current = run;
    try {
      await run;
    } finally {
      if (refreshPromiseRef.current === run) refreshPromiseRef.current = null;
    }
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

    const refreshSilently = () => {
      void refresh({ silent: true });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSilently();
    };

    window.addEventListener('everittos:workspace-plan-refresh', refreshSilently);
    window.addEventListener('focus', refreshSilently);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('everittos:workspace-plan-refresh', refreshSilently);
      window.removeEventListener('focus', refreshSilently);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  const value = useMemo<WorkspacePlanState>(() => ({ ...state, refresh }), [state, refresh]);

  return <WorkspacePlanContext.Provider value={value}>{children}</WorkspacePlanContext.Provider>;
}

export function useWorkspacePlan(): WorkspacePlanState {
  const ctx = useContext(WorkspacePlanContext);
  if (!ctx) throw new Error('useWorkspacePlan must be used within WorkspacePlanProvider');
  return ctx;
}

export function useWorkspacePlanOptional(): WorkspacePlanState | null {
  return useContext(WorkspacePlanContext);
}
