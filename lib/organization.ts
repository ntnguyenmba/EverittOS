import { supabase } from '@/lib/supabase';
import { fetchOrganizationContextForUser, type OrganizationContext } from '@/lib/organization-server';

export type { OrganizationContext };

export async function fetchOrganizationContext(userId: string): Promise<OrganizationContext | null> {
  return fetchOrganizationContextForUser(supabase, userId);
}
