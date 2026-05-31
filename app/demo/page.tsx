'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DemoPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function check() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/demo');
        return;
      }
      setReady(true);
    }
    check();
  }, [router]);

  if (!ready) {
    return <main className="section"><div className="container"><p>Loading field view...</p></div></main>;
  }

  return (
    <main className="section">
      <div className="container grid-2">
        <div>
          <div className="eyebrow">Field view</div>
          <h2>Assigned jobs on mobile</h2>
          <p>Open a job from your list to upload photos and update status in the field.</p>
          <Link className="btn btn-primary" href="/jobs">
            My jobs
          </Link>
        </div>
        <div className="mobile-frame">
          <div className="mobile-screen">
            <p>Sign in required</p>
            <h2>Your assigned work</h2>
            <p>Photos and status updates sync to the manager dashboard.</p>
            <Link className="btn btn-primary" href="/jobs" style={{ justifyContent: 'center' }}>
              Open jobs
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
