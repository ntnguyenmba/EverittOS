'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type JobCreatorProps = { onJobCreated?: (jobId: string) => void };
type Customer = { id: string; company_name?: string | null; contact_name?: string | null; email?: string | null; phone?: string | null; address_line1?: string | null; service_address?: string | null; property_address?: string | null };
type Property = { id: string; customer_id?: string | null; name?: string | null; formatted_address?: string | null; address?: string | null };

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    if (!title.trim()) { setError('Job title is required.'); return; }
    setSubmitting(true);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), customer_id: customerId || null, property_id: propertyId || null, customer_name: customerName.trim() || undefined, customer_email: customerEmail.trim() || undefined, phone: phone.trim() || undefined, address: address.trim() || undefined, notes: notes.trim() || undefined, start_date: startDate || null, due_date: dueDate || null })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.job?.id) throw new Error(json.error || 'Unable to create job.');
      if (onJobCreated) onJobCreated(json.job.id); else window.location.assign(`/jobs/${json.job.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create job.'); }
    finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ display: 'grid', gap: 18, maxWidth: 760 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <label><span>Start date</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label><span>Due date</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
      </div>

      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>More details</summary>
        <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
          <label><span>Customer name</span><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="name" /></label>
          <label><span>Email</span><input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} autoComplete="email" /></label>
          <label><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" /></label>
          <label><span>Address</span><input value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" /></label>
          <label><span>Notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} /></label>
        </div>
      </details>

      <div className="inline-actions" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn" onClick={() => window.history.back()} disabled={submitting}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create job'}</button>
      </div>
    </form>
  );
}
