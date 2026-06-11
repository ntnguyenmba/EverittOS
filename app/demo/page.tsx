'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';

export default function DemoPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function enterDemo() {
    setLoading(true);
    setError('');
    setMessage('');
    const res = await fetch('/api/demo/enter', { method: 'POST' });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      if (res.status === 401) {
        window.location.href = '/signup?plan=growth&next=/demo';
        return;
      }
      setError(json.error || 'Unable to start demo.');
      return;
    }
    setMessage(json.message || 'Demo ready.');
    window.location.href = json.redirectTo || '/dashboard';
  }

  return (
    <main className="section">
      <div className="container card" style={{ maxWidth: 640, margin: '48px auto' }}>
        <BrandLogo />
        <h1 style={{ marginTop: 16 }}>EverittOS demo</h1>
        <p className="muted">
          Explore a fully seeded workspace with sample company data, technicians, clients, jobs, and reports. Demo data is
          isolated from production organizations.
        </p>
        <ul>
          <li>Sample company: Everitt Demo Services</li>
          <li>Technicians, managers, and client portal examples</li>
          <li>Jobs, reports, and activity history</li>
          <li>No impact on live customer data</li>
        </ul>
        <div className="hero-actions" style={{ marginTop: 20 }}>
          <button type="button" className="btn btn-primary" disabled={loading} onClick={enterDemo}>
            {loading ? 'Preparing demo…' : 'View demo'}
          </button>
          <Link className="btn" href="/signup">
            Create real account
          </Link>
        </div>
        {error ? <p className="auth-message auth-message-error">{error}</p> : null}
        {message ? <p className="auth-message auth-message-success">{message}</p> : null}
      </div>
    </main>
  );
}
