'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type JobCreatorProps = {
  onJobCreated?: (jobId: string) => void;
};

type Customer = {
  id: string;
  name?: string | null;
  customer_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type Property = {
  id: string;
  customer_id?: string | null;
  formatted_address?: string | null;
  address?: string | null;
};

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch('/api/customers', { credentials: 'include', cache: 'no-store' }).then(async (res) => {
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json.customers) ? json.customers : [];
      }),
      fetch('/api/customer-properties', { credentials: 'include', cache: 'no-store' }).then(async (res) => {
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json.properties) ? json.properties : [];
      })
    ])
      .then(([customerRows, propertyRows]) => {
        if (!active) return;
        setCustomers(customerRows);
        setProperties(propertyRows);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const visibleProperties = useMemo(
    () => (customerId ? properties.filter((property) => property.customer_id === customerId) : properties),
    [customerId, properties]
  );

  useEffect(() => {
    if (!customerId) return;
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    setCustomerName(customer.name || customer.customer_name || '');
    setCustomerEmail(customer.email || '');
    setPhone(customer.phone || '');
  }, [customerId, customers]);

  useEffect(() => {
    if (!propertyId) return;
    const property = properties.find((item) => item.id === propertyId);
    if (!property) return;
    setAddress(property.formatted_address || property.address || '');
    if (property.customer_id && property.customer_id !== customerId) {
      setCustomerId(property.customer_id);
    }
  }, [propertyId, properties, customerId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError('');
    if (!title.trim()) {
      setError('Job title is required.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
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
          due_date: dueDate || null
        })
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.job?.id) {
        throw new Error(json.error || 'Unable to create job.');
      }

      if (onJobCreated) {
        onJobCreated(json.job.id);
      } else {
        window.location.assign(`/jobs/${json.job.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create job.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ display: 'grid', gap: 16 }}>
      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <label>
        <span>Job title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} required autoComplete="off" />
      </label>

      <label>
        <span>Customer</span>
        <select value={customerId} onChange={(event) => { setCustomerId(event.target.value); setPropertyId(''); }}>
          <option value="">No saved customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name || customer.customer_name || customer.email || 'Customer'}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Property</span>
        <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
          <option value="">No saved property</option>
          {visibleProperties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.formatted_address || property.address || 'Property'}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Customer name</span>
        <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" />
      </label>

      <label>
        <span>Email</span>
        <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} autoComplete="email" />
      </label>

      <label>
        <span>Phone</span>
        <input value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" />
      </label>

      <label>
        <span>Address</span>
        <input value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <label>
          <span>Start date</span>
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          <span>Due date</span>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
      </div>

      <label>
        <span>Notes</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
      </label>

      <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={() => window.history.back()} disabled={submitting}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create job'}
        </button>
      </div>
    </form>
  );
}
