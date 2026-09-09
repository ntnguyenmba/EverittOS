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

  useEffect(() => {
    if (isSessionExemptPath(pathname)) return;

    async function ensureWorkspace() {
      if (bootstrappingRef.current) return;
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      try {
        if (window.sessionStorage.getItem(readyKey(user.id)) === '1') return;
      } catch {
        /* storage blocked */
      }

      let org = await fetchOrganizationContext(user.id);
      if (org?.organizationId) {
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
