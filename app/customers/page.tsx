'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { CustomerLogo } from '@/components/customer-logo';
import { useTranslation } from '@/components/locale-provider';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { PageHeader } from '@/components/page-header';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { errorFeedback, formatSupabaseError, successFeedback, type ActionFeedback } from '@/lib/action-messages';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { filterDemoSeedCustomers } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { validatePlanAction } from '@/lib/plan-validate';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import {
  CUSTOMER_LIST_SELECT,
  customerDisplayAddress,
  customerDisplayName,
  type CustomerRecord
} from '@/lib/customer-record';
import { uploadCustomerLogo } from '@/lib/customer-logo';
import { monthStartIso } from '@/lib/date-filters';
import { supabase } from '@/lib/supabase';
import { ensureOrganizationForUser } from '@/lib/workspace-client';

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
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [role, setRole] = useState(normalizeRole('owner'));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setFeedback(null);

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
      setFeedback(errorFeedback(formatSupabaseError(error)));
      return;
    }
    setCustomers(filterDemoSeedCustomers(data || [], orgIsDemo));
  }

  function onLogoSelected(file: File | null) {
    setLogoFile(file);
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function addCustomer() {
    if (!displayName.trim()) {
      setFeedback(errorFeedback('Enter a customer name first.'));
      return;
    }
    if (saving) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/customers');
      return;
    }

    setSaving(true);
    setFeedback(null);

    const org = await ensureOrganizationForUser(user.id);
    if (!org?.organizationId) {
      setSaving(false);
      setFeedback(errorFeedback('Workspace setup is still finishing. Refresh and try again.'));
      return;
    }

    const { plan: orgPlan } = await resolveOrganizationPlan(supabase, user.id);
    const usage = await fetchUsageCounts(user.id, org?.organizationId);
    const check = validatePlanAction({ plan: orgPlan, resource: 'customers', currentCount: usage.customers });

    if (!check.allowed) {
      setSaving(false);
      setFeedback(errorFeedback(check.message || limitMessage('customers', orgPlan)));
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
      setFeedback(errorFeedback(serverJson.message || 'Plan limit reached.'));
      return;
    }

    const createRes = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, phone, email, address, notes })
    });
    const createJson = (await createRes.json()) as { customer?: { id: string }; error?: string };

    if (!createRes.ok) {
      setSaving(false);
      setFeedback(errorFeedback(createJson.error || 'Unable to save customer.'));
      return;
    }

    const createdCustomer = createJson.customer;

    if (logoFile && createdCustomer?.id) {
      const { path, error: uploadError } = await uploadCustomerLogo(
        supabase,
        org.organizationId,
        createdCustomer.id,
        logoFile
      );
      if (uploadError) {
        setSaving(false);
        setFeedback(errorFeedback(`Customer saved, but logo upload failed: ${uploadError}`));
        load();
        return;
      }
      if (path) {
        const logoRes = await fetch(`/api/customers/${createdCustomer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo_path: path })
        });
        if (!logoRes.ok) {
          const logoJson = (await logoRes.json().catch(() => ({}))) as { error?: string };
          setSaving(false);
          setFeedback(
            errorFeedback(`Customer saved, but logo could not be linked: ${logoJson.error || 'Update failed.'}`)
          );
          load();
          return;
        }
      }
    }

    setSaving(false);
    setFeedback(successFeedback(logoFile ? 'Customer and logo saved.' : 'Customer saved.'));
    setDisplayName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    onLogoSelected(null);
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
            <label className="auth-field">
              <span>Logo (optional)</span>
              <input
                className="input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => onLogoSelected(e.target.files?.[0] || null)}
              />
            </label>
            {logoPreviewUrl ? (
              <img src={logoPreviewUrl} alt="Logo preview" className="customer-logo-preview" width={72} height={72} />
            ) : null}
            <button className="btn btn-primary" type="button" onClick={addCustomer} disabled={saving}>
              {saving ? 'Saving...' : 'Save customer'}
            </button>
          </div>
        )}

        <div className="card">
          {loading && <p className="loading-state" role="status">Loading customers…</p>}
          <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />
          {!loading && customers.length === 0 && (
            <LocalizedEmptyState emptyKey="customers" />
          )}
          {!loading &&
            customers.map((customer) => (
              <div key={customer.id} className="card customer-card-row" style={{ marginTop: 12 }}>
                <CustomerLogo logoPath={customer.logo_path} alt={customerDisplayName(customer)} size={48} />
                <div>
                <h3>{customerDisplayName(customer)}</h3>
                <p className="muted">
                  {(customer.pipeline_stage || 'lead').replace('_', ' ')}
                  {customer.lead_source ? ` · ${customer.lead_source}` : ''}
                </p>
                <p>{customer.phone || 'No phone'}</p>
                <p>{customer.email || 'No email'}</p>
                <p>{customerDisplayAddress(customer, 'No address')}</p>
                <Link className="btn" href={`/customers/${customer.id}`}>
                  View customer
                </Link>
                <Link className="btn" href={`/jobs?customer=${customer.id}`}>
                  View jobs
                </Link>
                </div>
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
