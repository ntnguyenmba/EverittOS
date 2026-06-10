'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
        <Link href="/" className="logo">
          <span className="logo-mark" />
          EverittOS
        </Link>

        <nav className="nav-links">
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

              <button className="btn" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="btn" href="https://everittventures.com/tech">
            Everitt Ventures
          </Link>
          <Link className="btn" href="/login">
                Login
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