import { supabase } from '@/lib/supabase';
import { fetchOrganizationContextForUser, type OrganizationContext } from '@/lib/organization-server';

export type { OrganizationContext };

export async function fetchOrganizationContext(userId: string): Promise<OrganizationContext | null> {
  // In the browser, the active workspace is stored in an httpOnly cookie. The
  // browser cannot read that cookie directly, so resolve it on the server.
  // This keeps an owner workspace separate from another company's client or
  // worker membership for the same signed-in person.
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/api/org/context', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (response.ok) {
        const payload = (await response.json()) as { organization?: OrganizationContext | null };
        if (payload.organization) return payload.organization;
      }
    } catch {
      // Fall through to the membership resolver so temporary route/network
      // failures do not make the signed-in app unusable.
    }
  }

  return fetchOrganizationContextForUser(supabase, userId);
}
