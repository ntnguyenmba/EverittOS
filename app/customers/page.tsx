'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { useTranslation } from '@/components/locale-provider';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { filterDemoSeedCustomers } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { validatePlanAction } from '@/lib/plan-validate';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import {
  buildCustomerWritePayload,
  CUSTOMER_LIST_SELECT,
  customerDisplayName,
  type CustomerRecord
} from '@/lib/customer-record';
import { monthStartIso } from '@/lib/date-filters';
import { supabase } from '@/lib/supabase';

function CustomersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodFilter = searchParams.get('period');
  const stageFilter = searchParams.get('stage');
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [role, setRole] = useState(normalizeRole('owner'));

  async function load() {
    setLoading(true);
    setMessage('');

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

    const org = await fetchOrganizationContext(user.id);
    let query = supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .order('created_at', { ascending: false });
    if (org?.organizationId) {
      query = query.eq('organization_id', org.organizationId);
    } else {
      query = query.eq('user_id', user.id);
    }
    if (periodFilter === 'month') {
      query = query.gte('created_at', monthStartIso());
    }
    if (stageFilter === 'lead') {
      query = query.in('pipeline_stage', ['lead', 'qualified']);
    }

    const [{ data, error }, orgIsDemo] = await Promise.all([
      query,
      fetchOrganizationIsDemo(supabase, org?.organizationId)
    ]);

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setCustomers(filterDemoSeedCustomers(data || [], orgIsDemo));
  }

  async function addCustomer() {
    if (!displayName.trim() || saving) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    setMessage('');

    const org = await fetchOrganizationContext(user.id);
    const { plan: orgPlan } = await resolveOrganizationPlan(supabase, user.id);
    const usage = await fetchUsageCounts(user.id, org?.organizationId);
    const check = validatePlanAction({ plan: orgPlan, resource: 'customers', currentCount: usage.customers });

    if (!check.allowed) {
      setSaving(false);
      setMessage(check.message || limitMessage('customers', orgPlan));
      return;
    }

    const serverCheck = await fetch('/api/plan/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'customers' })
    });
    const serverJson = await serverCheck.json();
    if (!serverJson.allowed) {
      setSaving(false);
      setMessage(serverJson.message || 'Plan limit reached.');
      return;
    }

    const { error } = await supabase.from('customers').insert({
      user_id: user.id,
      organization_id: org?.organizationId || null,
      ...buildCustomerWritePayload({
        displayName,
        phone,
        email,
        address,
        notes
      })
    });

    setSaving(false);

    if (error) {
      if (error.message.includes('PLAN_LIMIT_CUSTOMERS')) {
        setMessage(limitMessage('customers', orgPlan));
      } else {
        setMessage(error.message);
      }
      return;
    }

    setDisplayName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    load();
  }

  useEffect(() => {
    load();
  }, [periodFilter, stageFilter]);

  return (
    <AppShell plan={plan} role={role}>
        <PageHeader title={t('nav.crm')} subtitle={t('ux.pageTitles.customers')} />

        {!canManage && (
          <div className="card">
            <p>Only owners and admins can manage customer records.</p>
          </div>
        )}

        {canManage && (
          <div className="card form" style={{ marginBottom: 18 }}>
            <h3>Add customer</h3>
            <input className="input" placeholder="Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            <textarea className="input" rows={3} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button className="btn btn-primary" type="button" onClick={addCustomer} disabled={saving}>
              {saving ? 'Saving...' : 'Save customer'}
            </button>
          </div>
        )}

        <div className="card">
          {loading && <p className="loading-state" role="status">Loading customers…</p>}
          {message && (
            <p className="auth-message auth-message-error" role="alert">
              {friendlyErrorMessage(message)}
            </p>
          )}
          {!loading && customers.length === 0 && (
            <LocalizedEmptyState emptyKey="customers" />
          )}
          {!loading &&
            customers.map((customer) => (
              <div key={customer.id} className="card" style={{ marginTop: 12 }}>
                <h3>{customerDisplayName(customer)}</h3>
                <p className="muted">
                  {(customer.pipeline_stage || 'lead').replace('_', ' ')}
                  {customer.lead_source ? ` · ${customer.lead_source}` : ''}
                </p>
                <p>{customer.phone || 'No phone'}</p>
                <p>{customer.email || 'No email'}</p>
                <p>{customer.address || 'No address'}</p>
                <Link className="btn" href={`/customers/${customer.id}`}>
                  View customer
                </Link>
                <Link className="btn" href={`/jobs?customer=${customer.id}`}>
                  View jobs
                </Link>
              </div>
            ))}
        </div>
    </AppShell>
  );
}

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersPageContent />
    </Suspense>
  );
}
