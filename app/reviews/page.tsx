'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { ReviewRequest } from '@/lib/os-types';

type CustomerReview = {
  id: string;
  review_request_id: string | null;
  rating: number | null;
  body: string | null;
  status: string;
  created_at: string;
};

export default function ReviewsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [email, setEmail] = useState('');
  const [messageText, setMessageText] = useState('We would love your feedback on our recent work.');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [canManage, setCanManage] = useState(false);

  async function load() {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const userRole = normalizeRole(profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(userRole);
    setCanManage(isManagerRole(userRole));

    const res = await fetch('/api/reviews');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.error || 'Unable to load reviews');
      return;
    }
    setRequests(json.requests || []);
    setReviews(json.reviews || []);
  }

  useEffect(() => {
    void load();
  }, [router]);

  async function createRequest(send: boolean) {
    if (!email.trim() || saving) return;
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_email: email.trim(), message: messageText, send })
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error || 'Failed to create request');
      return;
    }
    setEmail('');
    void load();
  }

  async function markSubmitted(id: string) {
    const rating = Number(prompt('Rating 1-5', '5'));
    if (!rating || rating < 1 || rating > 5) return;
    const body = prompt('Review text (optional)', '') || '';
    const res = await fetch(`/api/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'submitted', rating, review_body: body })
    });
    if (!res.ok) {
      const json = await res.json();
      setMessage(json.error || 'Update failed');
      return;
    }
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>Review Center</h1>
        <p className="page-subtitle">
          Request and track customer reviews. Google, Facebook, and Yelp integrations are planned — architecture is ready.
        </p>
      </header>

      {canManage ? (
        <div className="card form" style={{ marginBottom: 18 }}>
          <h3>New review request</h3>
          <input
            className="input"
            type="email"
            placeholder="Customer email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <textarea className="input" rows={3} value={messageText} onChange={(e) => setMessageText(e.target.value)} />
          <div className="settings-actions">
            <button type="button" className="btn" disabled={saving} onClick={() => void createRequest(false)}>
              Save draft
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void createRequest(true)}>
              Mark as sent
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="auth-message auth-message-error">{message}</p> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Requests</h3>
        {loading ? <p>Loading…</p> : null}
        {!loading && requests.length === 0 ? (
          <EmptyState compact title="No review requests" description="Send a request after a job is completed." />
        ) : null}
        {requests.map((r) => (
          <div key={r.id} className="dashboard-today-row">
            <span>{r.customer_email || 'No email'}</span>
            <span className="muted">
              {r.status}
              {canManage && r.status !== 'submitted' ? (
                <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => void markSubmitted(r.id)}>
                  Record review
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Submitted reviews</h3>
        {reviews.length === 0 ? <p className="muted">No reviews recorded yet.</p> : null}
        {reviews.map((r) => (
          <div key={r.id} className="dashboard-today-row">
            <span>{'★'.repeat(r.rating || 0)}</span>
            <span className="muted">{r.body || 'No comment'}</span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
