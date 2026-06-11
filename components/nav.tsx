'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { MARKETING_SITE_URL } from '@/lib/marketing-site';
import { supabase } from '@/lib/supabase';

/** Minimal chrome for legal and policy pages only. */
export function Nav() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();
      setLoggedIn(!!data.user);
    }

    checkUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    const { performClientLogout } = await import('@/lib/client-logout');
    await performClientLogout(router);
    setLoggedIn(false);
  }

  return (
    <header className="nav">
      <div className="container nav-inner">
        <BrandLogo href="/login" showName />

        <nav className="nav-links" aria-label="Legal">
          <a href={MARKETING_SITE_URL} target="_blank" rel="noopener noreferrer">
            Everitt Ventures
          </a>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>

        <div className="nav-actions">
          {loggedIn ? (
            <>
              <Link className="btn btn-primary" href="/dashboard">
                Open app
              </Link>
              <button className="btn" type="button" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link className="btn" href="/login">
                Sign in
              </Link>
              <Link className="btn btn-primary" href="/signup">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
