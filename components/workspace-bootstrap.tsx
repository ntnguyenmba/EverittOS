'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { fetchOrganizationContext } from '@/lib/organization';
import { isSessionExemptPath } from '@/lib/session-policy';
import { supabase } from '@/lib/supabase';

function readyKey(userId: string) {
  return `eo_workspace_ready:${userId}`;
}

/**
 * Ensures every signed-in user has a personal workspace without blocking navigation.
 * Runs once per user session after a workspace is confirmed.
 */
export function WorkspaceBootstrap() {
  const pathname = usePathname() || '/';
  const bootstrappingRef = useRef(false);
  const readyUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (isSessionExemptPath(pathname)) return;

    async function ensureWorkspace() {
      if (bootstrappingRef.current) return;
      // The local session only picks the cache key; the setup and ensure endpoints
      // verify the user on the server. This avoids an auth round trip per navigation.
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || readyUserRef.current === user.id) return;

      try {
        if (window.sessionStorage.getItem(readyKey(user.id)) === '1') {
          readyUserRef.current = user.id;
          return;
        }
      } catch {
        /* storage blocked */
      }

      let org = await fetchOrganizationContext(user.id);
      if (org?.organizationId) {
        readyUserRef.current = user.id;
        try {
          window.sessionStorage.setItem(readyKey(user.id), '1');
        } catch {
          /* storage blocked */
        }
        try {
          await fetch('/api/workspace/ensure', { method: 'POST' });
        } catch {
          /* company repair retries on next cold start */
        }
        return;
      }

      bootstrappingRef.current = true;
      try {
        await fetch('/api/auth/setup', { method: 'POST' });
        org = await fetchOrganizationContext(user.id);
        if (org?.organizationId) {
          readyUserRef.current = user.id;
          try {
            window.sessionStorage.setItem(readyKey(user.id), '1');
          } catch {
            /* storage blocked */
          }
          await fetch('/api/workspace/ensure', { method: 'POST' });
        }
      } catch {
        /* setup retries on next navigation */
      } finally {
        bootstrappingRef.current = false;
      }
    }

    void ensureWorkspace();
  }, [pathname]);

  return null;
}
