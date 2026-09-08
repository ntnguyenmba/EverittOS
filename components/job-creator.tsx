'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type JobCreatorProps = { onJobCreated?: (jobId: string) => void };
type Customer = { id: string; company_name?: string | null; contact_name?: string | null; email?: string | null; phone?: string | null; address_line1?: string | null; service_address?: string | null; property_address?: string | null };
type Property = { id: string; customer_id?: string | null; name?: string | null; formatted_address?: string | null; address?: string | null };

function optionalMoneyInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function JobCreator({ onJobCreated }: JobCreatorProps) {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState(searchParams.get('customerId') || '');
  const [propertyId, setPropertyId] = useState(searchParams.get('propertyId') || '');
  const [customerName, setCustomerName] = useState(searchParams.get('customerName') || '');
  const [customerEmail, setCustomerEmail] = useState(searchParams.get('customerEmail') || '');
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [address, setAddress] = useState(searchParams.get('address') || '');
  const [notes, setNotes] = useState(searchParams.get('notes') || '');
  const [startDate, setStartDate] = useState(searchParams.get('start_date') || '');
  const [dueDate, setDueDate] = useState(searchParams.get('due_date') || '');
  const [clientIncome, setClientIncome] = useState(searchParams.get('client_income') || searchParams.get('price') || '');
  const [contractorFlatRate, setContractorFlatRate] = useState(searchParams.get('contractor_pay') || '');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/customers/list', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Unable to load customers.');
        return Array.isArray(json.customers) ? json.customers : [];
      })
      .then((rows) => { if (active) setCustomers(rows); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Unable to load customers.'); })
      .finally(() => { if (active) setLoadingCustomers(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!customerId) { setProperties([]); setPropertyId(''); return; }
    let active = true;
    setLoadingProperties(true);
    fetch(`/api/customers/${encodeURIComponent(customerId)}/properties`, { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Unable to load properties.');
        return Array.isArray(json.properties) ? json.properties : [];
      })
      .then((rows) => { if (active) setProperties(rows); })
      .catch((err) => { if (active) { setProperties([]); setError(err instanceof Error ? err.message : 'Unable to load properties.'); } })
      .finally(() => { if (active) setLoadingProperties(false); });
    return () => { active = false; };
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    setCustomerName(customer.contact_name || customer.company_name || '');
    setCustomerEmail(customer.email || '');
    setPhone(customer.phone || '');
    setAddress(customer.service_address || customer.property_address || customer.address_line1 || '');
  }, [customerId, customers]);

  useEffect(() => {
    if (!propertyId) return;
    const property = properties.find((item) => item.id === propertyId);
    if (property) setAddress(property.formatted_address || property.address || '');
  }, [propertyId, properties]);

  const expectedContractorPay = optionalMoneyInput(contractorFlatRate);
  const previewRevenue = optionalMoneyInput(clientIncome) || 0;
  const previewCost = expectedContractorPay || 0;
  const previewProfit = Number((previewRevenue - previewCost).toFixed(2));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    if (!title.trim()) { setError('Job title is required.'); return; }
    if (contractorFlatRate.trim() && expectedContractorPay == null) {
      setError('Enter a valid contractor pay amount.');
      return;
    }
    if (clientIncome.trim() && optionalMoneyInput(clientIncome) == null) {
      setError('Enter a valid customer price.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          customer_id: customerId || null,
          property_id: propertyId || null,
          customer_name: customerName.trim() || undefined,
          customer_email: customerEmail.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          start_date: startDate || null,
          due_date: dueDate || null,
          revenue_amount: optionalMoneyInput(clientIncome),
          expected_contractor_cost: expectedContractorPay
        })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.job?.id) throw new Error(json.error || 'Unable to create job.');
      if (onJobCreated) onJobCreated(json.job.id); else window.location.assign(`/jobs/${json.job.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create job.'); }
    finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card unified-job-form" style={{ display: 'grid', gap: 'var(--eo-section-gap)', maxWidth: 760 }}>
      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <label>
        <span>Job title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoComplete="off" placeholder="Example: Weekly salon cleaning" />
      </label>

      <label>
        <span>Customer</span>
        <select value={customerId} disabled={loadingCustomers} onChange={(e) => { setCustomerId(e.target.value); setPropertyId(''); }}>
          <option value="">{loadingCustomers ? 'Loading customers…' : 'Select saved customer'}</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.contact_name || c.company_name || c.email || c.phone || 'Customer'}</option>)}
        </select>
      </label>

      <label>
        <span>Property</span>
        <select value={propertyId} disabled={!customerId || loadingProperties} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">{!customerId ? 'Select customer first' : loadingProperties ? 'Loading properties…' : properties.length ? 'Select saved property' : 'No saved properties'}</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name ? `${p.name}${p.formatted_address || p.address ? ` · ${p.formatted_address || p.address}` : ''}` : p.formatted_address || p.address || 'Property'}</option>)}
        </select>
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--eo-control-gap)' }}>
        <label><span>Start date</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label><span>Due date</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
      </div>

      <div className="job-create-section" style={{ display: 'grid', gap: 'var(--eo-control-gap)' }}>
        <label>
          <span>Customer price</span>
          <input className="input" type="number" min="0" step="0.01" inputMode="decimal" placeholder="150.00" value={clientIncome} onChange={(e) => setClientIncome(e.target.value)} />
        </label>
        <label>
          <span>Contractor pay</span>
          <input className="input" type="number" min="0" step="0.01" inputMode="decimal" placeholder="120.00" value={contractorFlatRate} onChange={(e) => setContractorFlatRate(e.target.value)} />
        </label>
        <p className="muted" style={{ margin: 0 }}>
          Expected profit: ${previewProfit.toFixed(2)}
        </p>
      </div>

      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>More details</summary>
        <div style={{ display: 'grid', gap: 'var(--eo-control-gap)', marginTop: 14 }}>
          <label><span>Customer name</span><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="name" /></label>
          <label><span>Email</span><input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} autoComplete="email" /></label>
          <label><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" /></label>
          <label><span>Address</span><input value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" /></label>
          <label><span>Notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} /></label>
        </div>
      </details>

      <div className="inline-actions" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--eo-control-gap)' }}>
        <button type="button" className="btn" onClick={() => window.history.back()} disabled={submitting}>Cancel</button>
        <button type="submit" className="btn btn-primary unified-job-save" disabled={submitting}>{submitting ? 'Creating…' : 'Create job'}</button>
      </div>
    </form>
  );
}
