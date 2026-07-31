import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { resolveMiddlewareWorkspaceContext } from '@/lib/middleware-workspace-context';

export const PROFILE_CORE_SELECT =
  'id, role, account_status, organization_id, business_name, email, deleted_at, deletion_scheduled_at' as const;

export const