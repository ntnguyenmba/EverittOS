'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  function openDashboard() {
    router.push('/dashboard');
  }

  return (
    <main className="section">
      <div className="container grid-2">
        <div>
          <h2>Login</h2>
          <p>Continue to the EverittOS dashboard.</p>
        </div>

        <div className="card form">
          <input className="input" placeholder="Email" type="email" />
          <input className="input" placeholder="Password" type="password" />

          <button className="btn btn-primary" type="button" onClick={openDashboard}>
            Continue
          </button>

          <Link className="btn" href="/dashboard">
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
