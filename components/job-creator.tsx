'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { useTranslation } from '@/components/locale-provider';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { getJobCreateCopy } from '@/lib/i18n/job-create-copy';
import { getRecurrenceCopy } from '@/lib/i18n/recurrence-copy';
import { calculateExpectedJobFinance, multiplyMoneyDollars, parseMoneyDollars } from '@/lib/money-decimal';
import type { StructuredAddress } from '@/lib/address/types';
import {
  RECURRING_GENERATION_WINDOW_DAYS,
  summarizeRecurrenceForLocale,
  type RecurrenceEndMode,
  type RecurrenceFrequency,
  type RecurrenceIntervalUnit
} from '@/lib/recurring-jobs';
import { TIME_ZONE_OPTIONS } from '@/lib/time-zones';

type JobCreatorProps = { onJobCreated?: (jobId: string) => void };
type Customer = {
  id: string;
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  service_address?: string | null;
  property_address?: string | null;
};
type Property = { id: string; customer_id?: string | null; name?: string | null; formatted_address?: string | null; address?: string | null };
type TeamMemberOption = { userId: string; label: string; role: string };
type VisitDraft = { id: string; visit_date: string; start_time: string; end_time: string; notes: string };
type ContractorPayMode = 'hourly' | 'flat';
type CustomerEntryMode = 'existing' | 'new';

function optionalMoneyInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = parseMoneyDollars(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

function newVisit(): VisitDraft {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, visit_date: '', start_time: '', end_time: '', notes: '' };
}

export function JobCreator({ onJobCreated }: JobCreatorProps) {
  const searchParams = useSearchParams();
  const { locale } = useTranslation();
  const createCopy = getJobCreateCopy(locale);
  const recurrenceCopy = getRecurrenceCopy(locale);
  const [title, setTitle] = useState('');
  const [customerMode, setCustomerMode] = useState<CustomerEntryMode>('existing');
  const customerSelectRef = useRef<HTMLSelectElement | null>(null);
  const [customerId, setCustomerId] = useState(searchParams.get('customerId') || '');
  const [propertyId, setPropertyId] = useState(searchParams.get('propertyId') || '');
  const [customerName, setCustomerName] = useState(searchParams.get('customerName') || '');
  const [customerEmail, setCustomerEmail] = useState(searchParams.get('customerEmail') || '');
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [address, setAddress] = useState(searchParams.get('address') || '');
  const [structuredAddress, setStructuredAddress] = useState<StructuredAddress | null>(null);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [notes, setNotes] = useState(searchParams.get('notes') || '');
  const [timeZone, setTimeZone] = useState('');
  const [clientIncome, setClientIncome] = useState(searchParams.get('client_income') || searchParams.get('price') || '');
  const [contractorPayMode, setContractorPayMode] = useState<ContractorPayMode>('flat');
  const [contractorHours, setContractorHours] = useState('');
  const [contractorHourlyRate, setContractorHourlyRate] = useState('');
  const [contractorFlatRate, setContractorFlatRate] = useState(searchParams.get('contractor_pay') || '');
  const [additionalExpenses, setAdditionalExpenses] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [visits, setVisits] = useState<VisitDraft[]>([newVisit()]);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('none');
  const [recurrenceStartDate, setRecurrenceStartDate] = useState('');
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([new Date().getDay()]);
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [recurrenceIntervalUnit, setRecurrenceIntervalUnit] = useState<RecurrenceIntervalUnit>('weeks');
  const [recurrenceEndMode, setRecurrenceEndMode] = useState<RecurrenceEndMode>('never');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceLimit, setRecurrenceLimit] = useState('');
  const [recurrenceFieldErrors, setRecurrenceFieldErrors] = useState<{ startDate?: string; weekdays?: string; endDate?: string; limit?: string; startTime?: string }>({});
  const isRecurring = recurrenceFrequency !== 'none';
  const primaryVisit = visits[0];

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
    fetch('/api/team/members', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        const members = Array.isArray(json.members) ? json.members : [];
        return members.map((member: { user_id?: string; role?: string; profile?: { full_name?: string | null; email?: string | null } }) => ({
          userId: member.user_id || '',
          role: member.role || 'employee',
          label: member.profile?.full_name || member.profile?.email || 'Team member'
        })).filter((member: TeamMemberOption) => member.userId);
      })
      .then((rows) => { if (active) setTeamMembers(rows); })
      .catch(() => { if (active) setTeamMembers([]); })
      .finally(() => { if (active) setLoadingTeam(false); });
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
      .then((rows) => {
        if (!active) return;
        setProperties(rows);
        setPropertyId((current) => {
          if (current && rows.some((row) => row.id === current)) return current;
          if (rows.length === 1) return rows[0].id;
          return '';
        });
      })
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
    const customerAddress = (customer.service_address || customer.property_address || customer.address_line1 || '').trim();
    if (customerAddress) {
      setAddress(customerAddress);
      setStructuredAddress(null);
    }
  }, [customerId, customers]);

  useEffect(() => {
    if (!customerId) return;
    if (propertyId) {
      const property = properties.find((item) => item.id === propertyId);
      const propertyAddress = (property?.formatted_address || property?.address || '').trim();
      if (propertyAddress) {
        setAddress(propertyAddress);
        setStructuredAddress(null);
      }
      return;
    }
    if (loadingProperties) return;
    const firstWithAddress = properties.find((item) => (item.formatted_address || item.address || '').trim());
    if (!firstWithAddress) return;
    const fallback = (firstWithAddress.formatted_address || firstWithAddress.address || '').trim();
    setAddress((current) => current.trim() || fallback);
    if (properties.length === 1) setPropertyId(firstWithAddress.id);
  }, [customerId, propertyId, properties, loadingProperties]);

  function setSeriesStartDate(value: string) {
    setRecurrenceStartDate(value);
    setRecurrenceFieldErrors((current) => ({ ...current, startDate: undefined }));
    setVisits((rows) => {
      if (!rows[0]) return [{ ...newVisit(), visit_date: value }];
      return rows.map((visit, index) => (index === 0 ? { ...visit, visit_date: value } : visit));
    });
  }

  function updateVisit(id: string, patch: Partial<VisitDraft>) {
    setVisits((rows) => rows.map((visit) => (visit.id === id ? { ...visit, ...patch } : visit)));
  }

  async function resolveTimezoneFromCoords(lat: number | null, lng: number | null) {
    if (lat == null || lng == null) return;
    try {
      const res = await fetch(`/api/address/timezone?lat=${lat}&lng=${lng}`);
      const json = (await res.json().catch(() => ({}))) as { timezone?: string };
      if (json.timezone) setTimeZone(json.timezone);
    } catch {
      /* keep current timezone */
    }
  }

  function chooseExistingCustomer() {
    setCustomerMode('existing');
    requestAnimationFrame(() => {
      const select = customerSelectRef.current;
      if (!select || select.disabled) return;
      select.focus();
      const picker = (select as HTMLSelectElement & { showPicker?: () => void }).showPicker;
      if (typeof picker === 'function') {
        try { picker.call(select); } catch { /* Safari may block showPicker outside a direct gesture */ }
      }
    });
  }
  function chooseNewCustomer() { setCustomerMode('new'); setCustomerId(''); setPropertyId(''); }

  const hasContractorPay = contractorPayMode === 'hourly'
    ? Boolean(contractorHours.trim() || contractorHourlyRate.trim())
    : Boolean(contractorFlatRate.trim());
  const expectedContractorPay = contractorPayMode === 'hourly'
    ? hasContractorPay ? multiplyMoneyDollars(contractorHourlyRate, contractorHours) : null
    : optionalMoneyInput(contractorFlatRate);
  const previewFinance = calculateExpectedJobFinance({
    clientPrice: clientIncome,
    contractorPay: contractorPayMode === 'hourly' ? multiplyMoneyDollars(contractorHourlyRate, contractorHours) : contractorFlatRate,
    additionalExpenses
  });
  const previewContractorPay = previewFinance.expectedContractorCost;
  const previewProfit = previewFinance.expectedProfit;
  const recurrenceSummary = summarizeRecurrenceForLocale({
    frequency: recurrenceFrequency,
    interval: Number(recurrenceInterval) || 1,
    intervalUnit: recurrenceIntervalUnit,
    weekday: recurrenceWeekdays[0] ?? null,
    weekdays: recurrenceWeekdays,
    startDate: recurrenceStartDate,
    endDate: recurrenceEndMode === 'on_date' ? recurrenceEndDate || null : null,
    occurrenceLimit: recurrenceEndMode === 'after_count' && recurrenceLimit ? Number(recurrenceLimit) : null,
    preferredStartTime: primaryVisit?.start_time || null,
    timezone: timeZone || null
  }, locale);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError('');
    if (!title.trim()) { setError('Job title is required.'); return; }
    const nextErrors: typeof recurrenceFieldErrors = {};
    if (isRecurring && !recurrenceStartDate.trim()) nextErrors.startDate = recurrenceCopy.startDateRequired;
    if (isRecurring && recurrenceEndMode === 'on_date' && recurrenceEndDate && recurrenceStartDate && recurrenceEndDate < recurrenceStartDate) {
      nextErrors.endDate = recurrenceCopy.endDateBeforeStart;
    }
    if (Object.keys(nextErrors).length) { setRecurrenceFieldErrors(nextErrors); return; }
    if (contractorFlatRate.trim()) {
      const flat = optionalMoneyInput(contractorFlatRate);
      if (flat == null || flat < 0) { setError('Enter a valid contractor pay amount.'); return; }
    }
    if (clientIncome.trim() && optionalMoneyInput(clientIncome) == null) {
      setError('Enter a valid customer price.');
      return;
    }
    setSubmitting(true);
    try {
      let resolvedCustomerId = customerId || null;
      let resolvedPropertyId = propertyId || null;
      const creatingNewCustomer = customerMode === 'new' && !customerId && Boolean(customerName.trim());
      const autoLinkedCustomer = false;
      const creatingNewProperty = customerMode === 'new' || (!propertyId && Boolean(address.trim()));
      if (creatingNewCustomer) {
        const createCustomerRes = await fetch('/api/customers', {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: customerName.trim(), email: customerEmail.trim() || null, phone: phone.trim() || null, address: address.trim() || null, record_type: 'customer', pipeline_stage: 'active' })
        });
        const createCustomerJson = await createCustomerRes.json().catch(() => ({}));
        if (!createCustomerRes.ok || !createCustomerJson.customer?.id) throw new Error(createCustomerJson.error || createCopy.unableToCreateCustomer);
        resolvedCustomerId = createCustomerJson.customer.id;
      }
      if (resolvedCustomerId && creatingNewProperty && address.trim() && (creatingNewCustomer || autoLinkedCustomer || creatingNewProperty)) {
        const propertyRes = await fetch(`/api/customers/${resolvedCustomerId}/properties`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newPropertyName.trim() || createCopy.propertyNamePlaceholder,
            formatted_address: structuredAddress?.formattedAddress || address,
            address_line_1: structuredAddress?.addressLine1 || address,
            city: structuredAddress?.city || null,
            state_code: structuredAddress?.stateCode || null,
            postal_code: structuredAddress?.postalCode || null,
            latitude: structuredAddress?.latitude ?? null,
            longitude: structuredAddress?.longitude ?? null,
            timezone: timeZone || null,
            forceNew: true
          })
        });
        const propertyJson = await propertyRes.json().catch(() => ({}));
        if (propertyRes.ok && propertyJson.property?.id) resolvedPropertyId = propertyJson.property.id;
      }
      const payloadBase = {
        title: title.trim(),
        customer_id: resolvedCustomerId,
        property_id: resolvedPropertyId,
        customer_name: customerName.trim() || undefined,
        customer_email: customerEmail.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        timezone: timeZone || null,
        assigned_to: assignedTo || null,
        expected_contractor_cost: expectedContractorPay,
        expected_additional_expense: optionalMoneyInput(additionalExpenses),
        expected_expense_description: expenseDescription.trim() || null
      };
      if (isRecurring) {
        const response = await fetch('/api/recurring-jobs', {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payloadBase,
            default_price: optionalMoneyInput(clientIncome),
            contractor_pay_basis: contractorPayMode,
            contractor_hours: contractorPayMode === 'hourly' && contractorHours.trim() ? parseMoneyDollars(contractorHours) : null,
            contractor_hourly_rate: contractorPayMode === 'hourly' && contractorHourlyRate.trim() ? parseMoneyDollars(contractorHourlyRate) : expectedContractorPay,
            recurrence: {
              frequency: recurrenceFrequency,
              interval: Number(recurrenceInterval) || 1,
              intervalUnit: recurrenceIntervalUnit,
              weekday: recurrenceWeekdays[0] ?? null,
              weekdays: recurrenceWeekdays,
              startDate: recurrenceStartDate,
              endMode: recurrenceEndMode,
              endDate: recurrenceEndMode === 'on_date' ? recurrenceEndDate || null : null,
              occurrenceLimit: recurrenceEndMode === 'after_count' && recurrenceLimit ? Number(recurrenceLimit) : null,
              preferredStartTime: primaryVisit?.start_time || null
            }
          })
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !(json.firstJobId || json.job?.id)) throw new Error(json.error || 'Unable to create recurring job.');
        const jobId = json.firstJobId || json.job.id;
        if (onJobCreated) onJobCreated(jobId); else window.location.assign(`/jobs/${jobId}`);
        return;
      }
      const firstVisit = visits[0];
      const response = await fetch('/api/jobs', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payloadBase,
          start_date: firstVisit?.visit_date || recurrenceStartDate || null,
          due_date: firstVisit?.visit_date || recurrenceStartDate || null,
          revenue_amount: optionalMoneyInput(clientIncome),
          visits: visits.filter((visit) => visit.visit_date).map((visit) => ({
            visit_date: visit.visit_date,
            start_time: visit.start_time,
            end_time: visit.end_time,
            notes: visit.notes.trim() || null
          }))
        })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.job?.id) throw new Error(json.error || 'Unable to create job.');
      if (onJobCreated) onJobCreated(json.job.id); else window.location.assign(`/jobs/${json.job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : createCopy.prepareCustomerProperty);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card unified-job-form" style={{ display: 'grid', gap: 'var(--eo-section-gap)', maxWidth: 760 }}>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <section className="job-create-section">
        <h4>{createCopy.customerHeading}</h4>
        {customerMode === 'existing' ? (
          <div className="client-summary-card" style={{ display: 'grid', gap: 10, marginTop: 4 }}>
            <label>
              <span>Saved customer</span>
              <select ref={customerSelectRef} value={customerId} disabled={loadingCustomers} onChange={(e) => { setCustomerId(e.target.value); setPropertyId(''); }}>
                <option value="">{loadingCustomers ? 'Loading customers…' : customers.length ? 'Select a customer' : 'No saved customers yet'}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.contact_name || customer.company_name || customer.email || customer.phone || 'Customer'}
                  </option>
                ))}
              </select>
            </label>
            {customerId && properties.length > 1 ? <p className="muted">{createCopy.multipleProperties}</p> : null}
            <label>
              <span>Saved property</span>
              <select value={propertyId} disabled={!customerId || loadingProperties} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">
                  {!customerId
                    ? 'Select a customer first'
                    : loadingProperties
                      ? 'Loading properties…'
                      : properties.length
                        ? createCopy.selectProperty
                        : 'No saved properties'}
                </option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name
                      ? `${property.name}${property.formatted_address || property.address ? ` \u00b7 ${property.formatted_address || property.address}` : ''}`
                      : property.formatted_address || property.address || 'Property'}
                  </option>
                ))}
              </select>
            </label>
            <AddressAutocomplete
              id="job-address"
              label={createCopy.serviceAddress}
              placeholder={createCopy.addressPlaceholder}
              value={address}
              onChange={(formatted, structured) => {
                setAddress(formatted);
                setStructuredAddress(structured);
                if (propertyId) {
                  const selected = properties.find((item) => item.id === propertyId);
                  const saved = (selected?.formatted_address || selected?.address || '').trim();
                  if (saved && formatted.trim() && saved !== formatted.trim()) setPropertyId('');
                }
              }}
              onSelect={(suggestion) => void resolveTimezoneFromCoords(suggestion.latitude, suggestion.longitude)}
            />
            <button type="button" className="btn" onClick={chooseNewCustomer}>{createCopy.newCustomer}</button>
          </div>
        ) : null}
        {customerMode === 'new' ? (
          <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn" onClick={chooseExistingCustomer}>Use a saved customer</button>
            <label><span>{createCopy.customerName}</span><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="name" /></label>
            <label><span>{createCopy.email}</span><input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} autoComplete="email" /></label>
            <label><span>{createCopy.phone}</span><input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
            <label htmlFor="property-name"><span>{createCopy.propertyName}</span><input id="property-name" value={newPropertyName} onChange={(e) => setNewPropertyName(e.target.value)} placeholder={createCopy.propertyNamePlaceholder} /></label>
            <AddressAutocomplete
              id="job-address-new"
              label={createCopy.serviceAddress}
              placeholder={createCopy.addressPlaceholder}
              value={address}
              onChange={(formatted, structured) => { setAddress(formatted); setStructuredAddress(structured); }}
              onSelect={(suggestion) => void resolveTimezoneFromCoords(suggestion.latitude, suggestion.longitude)}
            />
          </div>
        ) : null}
      </section>
      <section className="job-create-section">
        <h4>{createCopy.jobDetailsHeading}</h4>
        <label><span>{createCopy.jobTitle}</span><input value={title} onChange={(e) => setTitle(e.target.value)} required autoComplete="off" placeholder={createCopy.jobTitlePlaceholder} /></label>
      </section>
      <section className="job-create-section">
        <h4>{recurrenceCopy.scheduleHeading}</h4>
        <label htmlFor="recurrence-starts-on">{isRecurring ? recurrenceCopy.startsOn : createCopy.date}</label>
        <input id="recurrence-starts-on" name="recurrence_starts_on" className="input" type="date" required={isRecurring} aria-invalid={Boolean(recurrenceFieldErrors.startDate)} value={primaryVisit?.visit_date || recurrenceStartDate} onChange={(e) => setSeriesStartDate(e.target.value)} />
        {recurrenceFieldErrors.startDate ? <p className="auth-message auth-message-error" role="alert">{recurrenceFieldErrors.startDate}</p> : null}
        <div className="grid-2" style={{ marginTop: 12 }}>
          <label htmlFor="job-start-time">{recurrenceCopy.startTime}<input id="job-start-time" className="input" type="time" value={primaryVisit?.start_time || ''} onChange={(e) => primaryVisit && updateVisit(primaryVisit.id, { start_time: e.target.value })} /></label>
          <label htmlFor="job-end-time">{recurrenceCopy.endTime}<input id="job-end-time" className="input" type="time" value={primaryVisit?.end_time || ''} onChange={(e) => primaryVisit && updateVisit(primaryVisit.id, { end_time: e.target.value })} /></label>
        </div>
      </section>
      <section className="job-create-section">
        <h4>{createCopy.customerPriceHeading}</h4>
        <p className="muted">{createCopy.customerPriceHelp}</p>
        <label>{createCopy.customerPrice}<input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={clientIncome} onChange={(e) => setClientIncome(e.target.value)} /></label>
      </section>
      <section className="job-create-section">
        <h4>{createCopy.workerHeading}</h4>
        <label htmlFor="assigned-to">{createCopy.assignWorker}</label>
        <select id="assigned-to" className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} disabled={loadingTeam}>
          <option value="">{createCopy.unassigned}</option>
          {teamMembers.map((member) => <option key={member.userId} value={member.userId}>{member.label} · {member.role}</option>)}
        </select>
        <label style={{ marginTop: 12 }}>Worker price</label>
        <p className="muted">{createCopy.workerPriceHelp}</p>
        <div className="segmented-control" role="group" aria-label={getBillingOpsCopy(locale).paymentMethod}>
          <button type="button" className={`btn${contractorPayMode === 'flat' ? ' btn-primary' : ''}`} onClick={() => setContractorPayMode('flat')}>Flat rate</button>
          <button type="button" className={`btn${contractorPayMode === 'hourly' ? ' btn-primary' : ''}`} onClick={() => setContractorPayMode('hourly')}>Hourly</button>
        </div>
        {contractorPayMode === 'hourly' ? (
          <>
            <div className="grid-2">
              <label>{createCopy.hours}<input className="input" type="number" min="0" step="0.25" value={contractorHours} onChange={(e) => setContractorHours(e.target.value)} /></label>
              <label>Worker hourly rate<input className="input" type="number" min="0" step="0.01" value={contractorHourlyRate} onChange={(e) => setContractorHourlyRate(e.target.value)} /></label>
            </div>
            <p className="muted">Worker cost: ${previewContractorPay.toFixed(2)}</p>
          </>
        ) : (
          <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={contractorFlatRate} onChange={(e) => setContractorFlatRate(e.target.value)} />
        )}
      </section>
      <details open style={{ marginTop: 12 }}>
        <summary>More options</summary>
        <section className="job-create-section">
          <label htmlFor="recurrence-frequency">{recurrenceCopy.scheduleType}</label>
          <select id="recurrence-frequency" className="input" value={recurrenceFrequency} onChange={(e) => {
            const next = e.target.value as RecurrenceFrequency;
            setRecurrenceFrequency(next);
            if (next === 'daily') setRecurrenceIntervalUnit('days');
            if (next === 'monthly') setRecurrenceIntervalUnit('months');
            if (next === 'weekly' || next === 'biweekly' || next === 'every_three_weeks' || next === 'every_four_weeks') setRecurrenceIntervalUnit('weeks');
          }}>
            <option value="none">{recurrenceCopy.oneTime}</option>
            <option value="weekly">{recurrenceCopy.weekly}</option>
            <option value="biweekly">{recurrenceCopy.everyTwoWeeks}</option>
            <option value="every_three_weeks">{recurrenceCopy.everyThreeWeeks}</option>
            <option value="every_four_weeks">{recurrenceCopy.everyFourWeeks}</option>
            <option value="monthly">{recurrenceCopy.monthly}</option>
            <option value="custom">{recurrenceCopy.custom}</option>
          </select>
          {isRecurring ? (
            <>
              <label htmlFor="job-timezone">{recurrenceCopy.jobTimezone}</label>
              <select id="job-timezone" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                <option value="">{recurrenceCopy.companyDefaultTimezone}</option>
                {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <label htmlFor="recurrence-end-mode">{recurrenceCopy.ends}</label>
              <select id="recurrence-end-mode" className="input" value={recurrenceEndMode} onChange={(e) => setRecurrenceEndMode(e.target.value as RecurrenceEndMode)}>
                <option value="never">{recurrenceCopy.neverEnds}</option>
                <option value="on_date">{recurrenceCopy.endsOnDate}</option>
                <option value="after_count">{recurrenceCopy.endsAfterCount}</option>
              </select>
              {recurrenceEndMode === 'on_date' ? <label>{recurrenceCopy.endDate}<input className="input" type="date" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} /></label> : null}
              {recurrenceEndMode === 'after_count' ? <label>{recurrenceCopy.occurrenceCount}<input className="input" type="number" min="1" value={recurrenceLimit} onChange={(e) => setRecurrenceLimit(e.target.value)} /></label> : null}
              <p className="muted"><strong>{recurrenceCopy.summaryLabel}:</strong> {recurrenceSummary}</p>
              <p className="muted">Only the next {RECURRING_GENERATION_WINDOW_DAYS} days of visits are scheduled now. Financial defaults apply to each generated visit.</p>
            </>
          ) : (
            <>
              <label htmlFor="job-timezone">{createCopy.jobTimezone}</label>
              <select id="job-timezone" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                <option value="">{createCopy.companyDefaultTimezone}</option>
                {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </>
          )}
        </section>
        <section className="job-create-section">
          <label>Additional expected expenses</label>
          <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={additionalExpenses} onChange={(e) => setAdditionalExpenses(e.target.value)} />
          <label>{createCopy.expenseDescription}</label>
          <input className="input" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder={createCopy.expensePlaceholder} />
          <div className="finance-metric-grid financials-summary-grid" style={{ marginTop: 14 }}>
            <div className="finance-metric"><span className="finance-metric-label">{createCopy.customerPrice}</span><strong>${previewFinance.expectedRevenue.toFixed(2)}</strong></div>
            <div className="finance-metric"><span className="finance-metric-label">Worker price</span><strong>${previewContractorPay.toFixed(2)}</strong></div>
            <div className="finance-metric"><span className="finance-metric-label">Additional expenses</span><strong>${previewFinance.expectedAdditionalExpense.toFixed(2)}</strong></div>
            <div className="finance-metric featured"><span className="finance-metric-label">Expected profit</span><strong>${previewProfit.toFixed(2)}</strong></div>
          </div>
          <p className="muted">{createCopy.profitFormula}</p>
          <p className="muted">Review before saving. Unassigned worker can be assigned later.</p>
        </section>
      </details>
      <div className="inline-actions" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--eo-control-gap)' }}>
        <button type="button" className="btn" onClick={() => window.history.back()} disabled={submitting}>Cancel</button>
        <button type="submit" className="btn btn-primary unified-job-save" disabled={submitting}>{submitting ? 'Creating…' : createCopy.createJob}</button>
      </div>
    </form>
  );
}
