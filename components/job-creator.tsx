'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { normalizePlan } from '@/lib/everittos-plans';
import { fetchOrganizationContext } from '@/lib/organization';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { validatePlanAction } from '@/lib/plan-validate';

type JobCreatorProps = {
  onJobCreated?: () => void;
};

export function JobCreator({ onJobCreated }: JobCreatorProps) {
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [blocked, setBlocked] = useState(false);

  async function createJob() {
    if (!title.trim()) {
      alert('Add a job title first.');
      return;
    }

    setLoading(true);
    setCreated(false);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      alert('Sign in to create jobs.');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role, plan').eq('id', user.id).maybeSingle();
    if (!isManagerRole(normalizeRole(profile?.role))) {
      setBlocked(true);
      setLoading(false);
      return;
    }

    const org = await fetchOrganizationContext(user.id);
    const { plan: orgPlan } = await resolveOrganizationPlan(supabase, user.id);
    const usage = await fetchUsageCounts(user.id, org?.organizationId);
    const check = validatePlanAction({ plan: orgPlan, resource: 'jobs', currentCount: usage.jobs });
    if (!check.allowed) {
      setLoading(false);
      alert(check.message || limitMessage('jobs', orgPlan));
      return;
    }
    const serverCheck = await fetch('/api/plan/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'jobs' })
    });
    const serverJson = await serverCheck.json();
    if (!serverJson.allowed) {
      setLoading(false);
      alert(serverJson.message || 'Plan limit reached.');
      return;
    }

    const { data: createdJob, error } = await supabase
      .from('jobs')
      .insert([
        {
          user_id: user.id,
          organization_id: org?.organizationId || null,
          title: title.trim(),
          customer_name: customerName.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
          status: 'new'
        }
      ])
      .select('id')
      .single();

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (createdJob?.id) {
      void fetch('/api/integrations/google-calendar/sync-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: createdJob.id })
      });
    }

    setCreated(true);
    setTitle('');
    setAddress('');
    setCustomerName('');
    setPhone('');
    setNotes('');
    onJobCreated?.();
  }

  if (blocked) {
    return (
      <div className="card">
        <h3>Create a job</h3>
        <p>Only owners and managers can create new jobs.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Create a job</h3>
      <div className="form">
        <input className="input" placeholder="Job title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input" placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <textarea className="input" placeholder="Notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="btn-primary" onClick={createJob} disabled={loading}>
          {loading ? 'Creating...' : 'Create job'}
        </Button>
      </div>
      {created && <p style={{ color: 'var(--green)' }}>Job saved successfully.</p>}
    </div>
  );
}
