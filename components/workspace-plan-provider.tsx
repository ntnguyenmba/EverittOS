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
import { highestPlan } from '@/lib/plan-features';
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
const PLAN_REQUEST_TIMEOUT_MS = 3500;
const MIN_BACKGROUND_REFRESH_MS = 60_000;
const STRIPE_RECOVERY_SESSION_KEY = 'everittos_stripe_recovery_checked';

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
  return { profilePlan:null, subscriptionStatus:null, billingPlan:null, organizationPlan:null, plan:null, role:null, rawProfilePlan:null, rawSubscriptionStatus:null, loading:false, error };
}

function mergeWorkspacePlan(
  prev: Omit<WorkspacePlanState, 'refresh'>,
  next: Omit<WorkspacePlanState, 'refresh'>
): Omit<WorkspacePlanState, 'refresh'> {
  if (!next.error) return next;
  if (!prev.role && !prev.plan) return next;
  return {
    ...prev,
    loading: false,
    error: next.error,
    role: prev.role,
    plan: prev.plan ?? next.plan,
    profilePlan: prev.profilePlan ?? next.profilePlan,
    billingPlan: prev.billingPlan ?? next.billingPlan,
    organizationPlan: prev.organizationPlan ?? next.organizationPlan
  };
}

async function requestWorkspacePlan(): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PLAN_REQUEST_TIMEOUT_MS);
  try { return await fetch('/api/workspace/plan', { cache:'no-store', credentials:'same-origin', signal:controller.signal }); }
  finally { window.clearTimeout(timer); }
}

function stateFromJson(json: WorkspacePlanResponse): Omit<WorkspacePlanState, 'refresh'> {
  const profilePlan = json.profilePlan ? normalizePlan(json.profilePlan) : null;
  const billingPlan = json.billingPlan ? normalizePlan(json.billingPlan) : null;
  const organizationPlan = json.organizationPlan ? normalizePlan(json.organizationPlan) : null;
  return {
    profilePlan,
    subscriptionStatus: json.subscriptionStatus ?? json.rawSubscriptionStatus ?? null,
    billingPlan,
    organizationPlan,
    plan: highestPlan([billingPlan, organizationPlan, profilePlan]),
    role: json.role ? normalizeRole(json.role) : null,
    rawProfilePlan: json.rawProfilePlan ?? json.profilePlan ?? null,
    rawSubscriptionStatus: json.rawSubscriptionStatus ?? json.subscriptionStatus ?? null,
    loading: false,
    error: null
  };
}

async function fetchWorkspacePlan(): Promise<Omit<WorkspacePlanState, 'refresh'>> {
  try {
    const res = await requestWorkspacePlan();
    if (res.status === 401) return emptyPlanState();
    const json = (await res.json().catch(() => ({}))) as WorkspacePlanResponse;
    if (!res.ok) return emptyPlanState(json.error || 'Unable to load workspace plan.');
    return stateFromJson(json);
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError' ? 'Workspace plan request timed out.' : 'Unable to load workspace plan.';
    return emptyPlanState(message);
  }
}

export function WorkspacePlanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<WorkspacePlanState, 'refresh'>>({ ...emptyPlanState(), loading:true });
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const lastRefreshRef = useRef(0);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const run = (async () => {
      setState((prev) => ({ ...prev, loading:options?.silent ? prev.loading : true, error:null }));
      const next = await fetchWorkspacePlan();
      lastRefreshRef.current = Date.now();
      setState((prev) => mergeWorkspacePlan(prev, next));
    })();
    refreshPromiseRef.current = run;
    try { await run; } finally { if (refreshPromiseRef.current === run) refreshPromiseRef.current = null; }
  }, []);

  const refreshIfStale = useCallback(() => {
    if (Date.now() - lastRefreshRef.current < MIN_BACKGROUND_REFRESH_MS) return;
    void refresh({ silent:true });
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void refresh({ silent:true });
    });
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refreshIfStale(); };
    const forceRefresh = () => void refresh({ silent:true });
    window.addEventListener('everittos:workspace-plan-refresh', forceRefresh);
    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('everittos:workspace-plan-refresh', forceRefresh);
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh, refreshIfStale]);

  useEffect(() => {
    if (state.loading || state.plan !== 'free' || typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(STRIPE_RECOVERY_SESSION_KEY)) return;
    window.sessionStorage.setItem(STRIPE_RECOVERY_SESSION_KEY, '1');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), PLAN_REQUEST_TIMEOUT_MS);
    void fetch('/api/stripe/sync-current-user', { method:'POST', credentials:'same-origin', signal:controller.signal })
      .then((response) => { if (response.ok) void refresh({ silent:true }); })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [state.loading, state.plan, refresh]);

  const value = useMemo<WorkspacePlanState>(() => ({ ...state, refresh }), [state, refresh]);
  return <WorkspacePlanContext.Provider value={value}>{children}</WorkspacePlanContext.Provider>;
}

export function useWorkspacePlan(): WorkspacePlanState { const ctx=useContext(WorkspacePlanContext); if(!ctx) throw new Error('useWorkspacePlan must be used within WorkspacePlanProvider'); return ctx; }
export function useWorkspacePlanOptional(): WorkspacePlanState | null { return useContext(WorkspacePlanContext); }
