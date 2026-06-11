'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { supabase } from '@/lib/supabase';

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
    await supabase.auth.signOut();
    setLoggedIn(false);
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="nav">
      <div className="container nav-inner">
        <BrandLogo href="/" showName />

        <nav className="nav-links" aria-label="Marketing">
          <Link href="/product">Product</Link>
          <Link href="/industries">Industries</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/demo">Demo</Link>
        </nav>

        <div className="nav-actions">
          {loggedIn ? (
            <>
              <Link className="btn btn-primary" href="/dashboard">
                Dashboard
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
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
