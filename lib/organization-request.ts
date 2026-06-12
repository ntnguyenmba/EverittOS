import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { ACTIVE_ORG_COOKIE } from '@/lib/org-context-cookie';
import {
  fetchOrganizationContextForUser,
  type OrganizationContext
} from '@/lib/organization-server';

/**
 * Resolve organization context for API routes using the active workspace cookie
 * when present, so connect/callback/status/disconnect target the same org.
 */
export async function fetchOrganizationContextForRequest(
  supabase: SupabaseClient,
  userId: string
): Promise<OrganizationContext | null> {
  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  return fetchOrganizationContextForUser(supabase, userId, activeOrgId);
}
