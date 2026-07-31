'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { supabase } from '@/lib/supabase';
import { Button } from './ui/button';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { fetchUsageCounts, limitMessage } from '@/lib/everittos-usage';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { validatePlanAction } from '@/lib/plan-validate';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';
import { compressImageFile } from '@/lib/image-compress';
import { insertJobPhotoRow } from '@/lib/job-photos-client';
import { buildSafePhotoStoragePath, validateImageUpload } from '@/lib/upload-security';
import { wallClockDateTime } from '@/lib/schedule-times';
import { TIME_ZONE_OPTIONS } from '@/lib/time-zones';
import type { StructuredAddress } from '@/lib/address/types';
import { PROPERTY_TYPE_LABELS, type PropertyType } from '@/lib/customer-property';

type JobCreatorProps = {
  onJobCreated?: (jobId: string) => void;
};

type TeamMemberOption = {
  userId: string;
  label: string;
  role: string;
};

type VisitDraft = {
  id: string;
  visit_date: string;
  start_time: string;
  end_time: string;
  notes: string;
};

type MemberRow = {
  user_id: string;
  role: string;
  active: boolean;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type ContractorPayMode = 'hourly' | 'flat';

type PropertyOption = {
  id: string;
  customer_id: string;
  name: string;
  property_type?: string | null;
  formatted_address?: string | null;
  address?: string | null;
  display_address?: string | null;
  timezone?: string | null;
  is_primary?: boolean;
  default_price?: number | null;
  default_duration_minutes?: number | null;
  access_instructions?: string | null;
  supply_notes?: string | null;
  parking_instructions?: string | null;
  pet_notes?: string | null;
  preferred_contractor_id?: string | null;
};

type CustomerOption = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  address?: string | null;
  properties: PropertyOption[];
};

type AddressMode = 'job_only' | 'save_new_property' | 'update_selected_property';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function memberLabel(member: MemberRow, profile?: ProfileRow) {
  const name = profile?.full_name?.trim() || '';
  const email = profile?.email?.trim() || '';
  if (name && !isUuid(name) && name.toLowerCase() !== email.toLowerCase()) return name;
  if (email) return email;
  return 'Team member';
}

function roleLabel(value: string) {
  const normalized = normalizeRole(value);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replaceAll('_', ' ');
}

function newVisit(): VisitDraft {
  return {
    id: crypto.randomUUID(),
    visit_date: '',
    start_time: '',
    end_time: '',
    notes: ''
  };
}

function validVisits(visits: VisitDraft[]) {
  return visits.filter((visit) => visit.visit_date || visit.start_time || visit.end_time || visit.notes.trim());
}

function moneyValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function propertyLabel(property: PropertyOption) {
  const type = (property.property_type || 'home') as PropertyType;
  const typeLabel = PROPERTY_TYPE_LABELS[type] || 'Property';
  const address = property.display_address || property.formatted_address || property.address || 'No address';
  return `${property.name} · ${typeLabel} · ${address}`;
}

export function JobCreator({ onJobCreated }: JobCreatorProps) {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [structuredAddress, setStructuredAddress] = useState<StructuredAddress | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [clientIncome, setClientIncome] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [contractorPayMode, setContractorPayMode] = useState<ContractorPayMode>('hourly');
  const [contractorHours, setContractorHours] = useState('');
  const [contractorHourlyRate, setContractorHourlyRate] = useState('');
  const [contractorFlatRate, setContractorFlatRate] = useState('');
  const [contractorNotes, setContractorNotes] = useState('');
  const [initialPhotos, setInitialPhotos] = useState<File[]>([]);
  const [visits, setVisits] = useState<VisitDraft[]>([newVisit()]);
  const [assignedTo, setAssignedTo] = useState(searchParams.get('assigned_to') || '');
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [loading, setLoading] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [creatingNewProperty, setCreatingNewProperty] = useState(false);
  const [addressMode, setAddressMode] = useState<AddressMode>('job_only');
  const [showAdvancedProperty, setShowAdvancedProperty] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadDone = useRef(false);

  const appFeedback = useAppFeedback();
  const { t } = useTranslation();

  useEffect(() => {
    async function loadTeamMembers() {
      setLoadingTeam(true);
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setLoadingTeam(false);
        return;
      }

      const workspace = await ensureWorkspaceForSave(user.id);
      if (!workspace.ok) {
        setLoadingTeam(false);
        return;
      }

      const { data: memberRows } = await supabase
        .from('organization_members')
        .select('user_id, role, active')
        .eq('organization_id', workspace.workspace.organizationId)
        .eq('active', true)
        .in('role', ['owner', 'admin', 'manager', 'employee', 'contractor'])
        .order('role');

      const members = (memberRows || []) as MemberRow[];
      const memberIds = members.map((member) => member.user_id);
      const { data: profileRows } = memberIds.length
        ? await supabase.from('profiles').select('id, email, full_name').in('id', memberIds)
        : { data: [] as ProfileRow[] };

      const profiles = new Map<string, ProfileRow>();
      for (const profile of (profileRows || []) as ProfileRow[]) {
        profiles.set(profile.id, profile);
      }

      setTeamMembers(
        members.map((member) => ({
          userId: member.user_id,
          role: normalizeRole(member.role),
          label: memberLabel(member, profiles.get(member.user_id))
        }))
      );
      setLoadingTeam(false);
    }

    void loadTeamMembers();
  }, []);

  useEffect(() => {
    if (preloadDone.current) return;
    const customerId = searchParams.get('customerId') || searchParams.get('customer_id');
    const propertyId = searchParams.get('propertyId') || searchParams.get('property_id');

    async function preload() {
      if (customerId && isUuid(customerId)) {
        preloadDone.current = true;
        await selectCustomerById(customerId, propertyId && isUuid(propertyId) ? propertyId : undefined);
      }
    }

    void preload();
    // Prefill from query params once on mount / param change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectCustomerById is stable for this page lifecycle
  }, [searchParams]);

  async function selectCustomerById(customerId: string, propertyId?: string) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id, company_name, email, phone')
      .eq('id', customerId)
      .maybeSingle();

    const propsRes = await fetch(`/api/customers/${customerId}/properties`);
    const propsJson = (await propsRes.json().catch(() => ({}))) as { properties?: PropertyOption[] };

    if (!customer) return;

    const option: CustomerOption = {
      id: customer.id,
      name: customer.company_name || customer.email || 'Customer',
      email: customer.email,
      phone: customer.phone,
      company_name: customer.company_name,
      properties: (propsJson.properties || []).map((p) => ({
        ...p,
        display_address: p.formatted_address || p.address || null
      }))
    };
    applyCustomer(option, propertyId);
  }

  function applyCustomer(customer: CustomerOption, propertyId?: string) {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.name);
    setCustomerName(customer.name);
    setPhone(customer.phone || '');
    setCustomerResults([]);
    setCreatingNewProperty(false);

    const preferred =
      (propertyId && customer.properties.find((p) => p.id === propertyId)) ||
      customer.properties.find((p) => p.is_primary) ||
      customer.properties[0] ||
      null;

    if (preferred) {
      applyProperty(preferred);
    } else {
      setSelectedPropertyId('');
      setCreatingNewProperty(true);
      setAddressMode('save_new_property');
      setNewPropertyName('Primary');
    }
  }

  function applyProperty(property: PropertyOption) {
    setSelectedPropertyId(property.id);
    setCreatingNewProperty(false);
    setAddressMode('job_only');
    const nextAddress = property.display_address || property.formatted_address || property.address || '';
    setAddress(nextAddress);
    setStructuredAddress(null);
    if (property.timezone) setTimeZone(property.timezone);
    if (property.default_price != null && !clientIncome) setClientIncome(String(property.default_price));
    if (property.preferred_contractor_id) setAssignedTo(property.preferred_contractor_id);

    const noteBits = [
      property.access_instructions?.trim() ? `Access: ${property.access_instructions.trim()}` : null,
      property.parking_instructions?.trim() ? `Parking: ${property.parking_instructions.trim()}` : null,
      property.pet_notes?.trim() ? `Pets: ${property.pet_notes.trim()}` : null,
      property.supply_notes?.trim() ? `Supplies: ${property.supply_notes.trim()}` : null
    ].filter(Boolean);
    if (noteBits.length) {
      setNotes((current) => {
        const existing = current.trim();
        const addition = noteBits.join('\n');
        if (!existing) return addition;
        if (existing.includes(addition)) return existing;
        return `${existing}\n\n${addition}`;
      });
    }
    setAccessInstructions(property.access_instructions || '');
  }

  useEffect(() => {
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    if (selectedCustomer && customerQuery === selectedCustomer.name) {
      setCustomerResults([]);
      return;
    }
    if (customerQuery.trim().length < 1) {
      setCustomerResults([]);
      return;
    }
    customerSearchTimer.current = setTimeout(() => {
      void (async () => {
        setCustomerSearching(true);
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(customerQuery.trim())}`);
        const json = (await res.json().catch(() => ({}))) as { customers?: CustomerOption[] };
        setCustomerResults(json.customers || []);
        setCustomerSearching(false);
      })();
    }, 250);
    return () => {
      if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    };
  }, [customerQuery, selectedCustomer]);

  async function resolveTimezoneFromCoords(lat: number | null, lng: number | null) {
    if (lat == null || lng == null) return;
    try {
      const res = await fetch(`/api/address/timezone?lat=${lat}&lng=${lng}`);
      const json = (await res.json().catch(() => ({}))) as { timezone?: string };
      if (json.timezone) setTimeZone(json.timezone);
    } catch {
      // Manual timezone selection remains available.
    }
  }

  function updateVisit(id: string, patch: Partial<VisitDraft>) {
    setVisits((rows) => rows.map((visit) => (visit.id === id ? { ...visit, ...patch } : visit)));
  }

  function removeVisit(id: string) {
    setVisits((rows) => (rows.length === 1 ? rows : rows.filter((visit) => visit.id !== id)));
  }

  async function uploadInitialPhotos(jobId: string, organizationId: string, userId: string, uploaderName: string) {
    for (const rawFile of initialPhotos) {
      const validation = validateImageUpload(rawFile);
      if (!validation.ok) continue;
      const file = await compressImageFile(rawFile);
      const revalidation = validateImageUpload(file);
      if (!revalidation.ok) continue;
      const path = buildSafePhotoStoragePath(userId, jobId, revalidation.extension);
      const fileName = file.name || `${revalidation.sanitizedBaseName}.${revalidation.extension}`;
      const { error: uploadError } = await supabase.storage.from('job-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      });
      if (uploadError) continue;
      const { error: rowError } = await insertJobPhotoRow(supabase, {
        userId,
        jobId,
        organizationId,
        storagePath: path,
        photoType: 'before',
        fileName,
        uploaderDisplayName: uploaderName,
        fileSizeBytes: file.size,
        mimeType: file.type || 'image/jpeg'
      });
      if (rowError) await supabase.storage.from('job-photos').remove([path]);
    }
  }

  async function ensurePropertyForJob(customerId: string): Promise<string | null> {
    if (selectedPropertyId && addressMode !== 'save_new_property' && !creatingNewProperty) {
      if (addressMode === 'update_selected_property' && structuredAddress) {
        await fetch(`/api/customers/${customerId}/properties/${selectedPropertyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formatted_address: structuredAddress.formattedAddress,
            address_line_1: structuredAddress.addressLine1,
            address_line_2: structuredAddress.addressLine2,
            city: structuredAddress.city,
            county: structuredAddress.county,
            state: structuredAddress.state,
            state_code: structuredAddress.stateCode,
            postal_code: structuredAddress.postalCode,
            country: structuredAddress.country,
            country_code: structuredAddress.countryCode,
            latitude: structuredAddress.latitude,
            longitude: structuredAddress.longitude,
            timezone: timeZone || null,
            access_instructions: accessInstructions || null
          })
        });
      }
      return selectedPropertyId;
    }

    if (addressMode === 'save_new_property' || creatingNewProperty) {
      const name = newPropertyName.trim() || 'Service location';
      const res = await fetch(`/api/customers/${customerId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          property_type: 'home',
          formatted_address: structuredAddress?.formattedAddress || address,
          address_line_1: structuredAddress?.addressLine1 || address,
          address_line_2: structuredAddress?.addressLine2 || null,
          city: structuredAddress?.city || null,
          county: structuredAddress?.county || null,
          state: structuredAddress?.state || null,
          state_code: structuredAddress?.stateCode || null,
          postal_code: structuredAddress?.postalCode || null,
          country: structuredAddress?.country || null,
          country_code: structuredAddress?.countryCode || null,
          latitude: structuredAddress?.latitude ?? null,
          longitude: structuredAddress?.longitude ?? null,
          timezone: timeZone || null,
          access_instructions: accessInstructions || null,
          is_primary: !(selectedCustomer?.properties?.length)
        })
      });
      const json = (await res.json().catch(() => ({}))) as { property?: { id: string }; error?: string };
      if (!res.ok || !json.property?.id) {
        throw new Error(json.error || 'Unable to save property.');
      }
      return json.property.id;
    }

    return selectedPropertyId || null;
  }

  async function createJob(event?: FormEvent) {
    event?.preventDefault();
    if (loading) return;

    if (!title.trim()) {
      appFeedback.error('Add a job title first.');
      return;
    }

    const scheduledVisits = validVisits(visits);
    for (const visit of scheduledVisits) {
      if (!visit.visit_date || !visit.start_time || !visit.end_time) {
        appFeedback.error('Each visit needs a date, start time, and end time.');
        return;
      }
      if (visit.end_time <= visit.start_time) {
        appFeedback.error('Visit end time must be after start time.');
        return;
      }
    }

    const hasContractorPay = contractorName.trim() || contractorHours || contractorHourlyRate || contractorFlatRate;
    if (hasContractorPay && !contractorName.trim()) {
      appFeedback.error('Add the contractor or cleaner name.');
      return;
    }
    if (hasContractorPay && contractorPayMode === 'hourly' && (moneyValue(contractorHours) <= 0 || moneyValue(contractorHourlyRate) < 0)) {
      appFeedback.error('Enter valid contractor hours and hourly rate.');
      return;
    }
    if (hasContractorPay && contractorPayMode === 'flat' && moneyValue(contractorFlatRate) <= 0) {
      appFeedback.error('Enter a valid flat-rate contractor amount.');
      return;
    }

    const firstVisit = scheduledVisits[0];
    const lastVisit = scheduledVisits[scheduledVisits.length - 1];
    const scheduledStart = firstVisit ? wallClockDateTime(firstVisit.visit_date, firstVisit.start_time) : null;
    const scheduledEnd = lastVisit ? wallClockDateTime(lastVisit.visit_date, lastVisit.end_time) : null;

    setLoading(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      appFeedback.error('Sign in to create jobs.');
      return;
    }

    const workspace = await ensureWorkspaceForSave(user.id);
    if (!workspace.ok) {
      setLoading(false);
      appFeedback.error(workspace.error);
      return;
    }
    const org = workspace.workspace;

    const { data: profile } = await supabase.from('profiles').select('role, plan, full_name, email').eq('id', user.id).maybeSingle();
    const role = normalizeRole(org.role || profile?.role);
    if (!isManagerRole(role)) {
      setPermissionBlocked(true);
      setLoading(false);
      appFeedback.error(t('pages.jobs.createPermissionBlocked'));
      return;
    }

    const { plan: orgPlan } = await resolveOrganizationPlan(supabase, user.id);
    const usage = await fetchUsageCounts(user.id, org.organizationId);
    const check = validatePlanAction({ plan: orgPlan, resource: 'jobs', currentCount: usage.jobs });
    if (!check.allowed) {
      setLoading(false);
      appFeedback.error(check.message || limitMessage('jobs', orgPlan));
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
      appFeedback.error(serverJson.message || 'Plan limit reached.');
      return;
    }

    let customerId = selectedCustomer?.id || null;
    let propertyId: string | null = null;

    try {
      if (!customerId && customerName.trim()) {
        const createCustomerRes = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: customerName.trim(),
            phone: phone.trim() || null,
            record_type: 'customer',
            pipeline_stage: 'active'
          })
        });
        const createCustomerJson = (await createCustomerRes.json().catch(() => ({}))) as {
          customer?: { id: string };
          error?: string;
        };
        if (!createCustomerRes.ok || !createCustomerJson.customer?.id) {
          throw new Error(createCustomerJson.error || 'Unable to create customer.');
        }
        customerId = createCustomerJson.customer.id;
        setAddressMode('save_new_property');
      }

      if (customerId && (address.trim() || selectedPropertyId || creatingNewProperty || addressMode === 'save_new_property')) {
        propertyId = await ensurePropertyForJob(customerId);
      }
    } catch (error) {
      setLoading(false);
      appFeedback.error(error instanceof Error ? error.message : 'Unable to prepare customer/property.');
      return;
    }

    const createRes = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        customer_name: customerName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        timezone: timeZone || null,
        customer_id: customerId,
        property_id: propertyId,
        revenue_amount: clientIncome ? moneyValue(clientIncome) : null,
        assigned_to: assignedTo || null,
        start_date: firstVisit?.visit_date || null,
        due_date: lastVisit?.visit_date || null,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        visits: scheduledVisits.map((visit) => ({
          visit_date: visit.visit_date,
          start_time: visit.start_time,
          end_time: visit.end_time,
          notes: visit.notes.trim() || null
        })),
        status: 'new'
      })
    });
    const createJson = (await createRes.json()) as { job?: { id: string }; error?: string };

    if (!createRes.ok || !createJson.job?.id) {
      setLoading(false);
      appFeedback.error(createJson.error || 'Unable to save job.');
      return;
    }

    const jobId = createJson.job.id;
    const followUpTasks: Promise<unknown>[] = [];

    if (clientIncome) {
      followUpTasks.push(
        fetch(`/api/jobs/${jobId}/profitability`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revenue_amount: moneyValue(clientIncome), revenue_notes: 'Added during job creation' })
        })
      );
    }

    if (hasContractorPay) {
      const hours = contractorPayMode === 'hourly' ? moneyValue(contractorHours) : 1;
      const rate = contractorPayMode === 'hourly' ? moneyValue(contractorHourlyRate) : moneyValue(contractorFlatRate);
      followUpTasks.push(
        fetch(`/api/jobs/${jobId}/labor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worker_id: null,
            worker_name: contractorName.trim(),
            hours,
            hourly_cost: rate,
            notes: contractorNotes.trim() || (contractorPayMode === 'flat' ? 'Flat-rate contractor pay' : null)
          })
        })
      );
    }

    if (initialPhotos.length > 0) {
      followUpTasks.push(
        uploadInitialPhotos(
          jobId,
          org.organizationId,
          user.id,
          profile?.full_name || profile?.email || user.email || 'Team member'
        )
      );
    }

    await Promise.allSettled(followUpTasks);

    void fetch('/api/integrations/google-calendar/sync-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });

    setLoading(false);
    appFeedback.created();
    onJobCreated?.(jobId);
  }

  if (permissionBlocked) {
    return (
      <div className="card">
        <h3>{t('pages.jobs.createTitle')}</h3>
        <p>{t('pages.jobs.createPermissionBlocked')}</p>
      </div>
    );
  }

  const previewContractorPay = contractorPayMode === 'hourly'
    ? moneyValue(contractorHours) * moneyValue(contractorHourlyRate)
    : moneyValue(contractorFlatRate);
  const previewProfit = moneyValue(clientIncome) - previewContractorPay;
  const selectedProperty = selectedCustomer?.properties.find((p) => p.id === selectedPropertyId) || null;
  const addressChangedFromProperty =
    Boolean(selectedProperty) &&
    Boolean(address.trim()) &&
    address.trim() !== (selectedProperty?.display_address || selectedProperty?.formatted_address || selectedProperty?.address || '').trim();

  return (
    <div className="card">
      <h3>{t('pages.jobs.createTitle')}</h3>
      <p className="muted">Select a customer and property first, then confirm the schedule. Most fields fill automatically.</p>
      <form className="form unified-job-form" onSubmit={createJob}>
        <section className="job-create-section">
          <h4>1. Customer</h4>
          <label htmlFor="customer-search">Search customers</label>
          <input
            id="customer-search"
            className="input"
            value={customerQuery}
            placeholder="Name, phone, email, company, or property address"
            autoComplete="off"
            onChange={(e) => {
              setCustomerQuery(e.target.value);
              if (selectedCustomer) setSelectedCustomer(null);
            }}
          />
          {customerSearching ? <p className="muted" role="status">Searching…</p> : null}
          {customerResults.length > 0 ? (
            <div role="listbox" aria-label="Customer matches" style={{ border: '1px solid var(--line)', borderRadius: 12, marginTop: 8 }}>
              {customerResults.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className="btn"
                  style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 0 }}
                  onClick={() => applyCustomer(customer)}
                >
                  <strong>{customer.name}</strong>
                  <span className="muted" style={{ display: 'block' }}>
                    {[customer.phone, customer.email, customer.properties[0]?.display_address].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {!selectedCustomer ? (
            <div className="grid-2" style={{ marginTop: 12 }}>
              <div className="form-group">
                <label>New customer name</label>
                <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <p>
                <strong>{selectedCustomer.name}</strong>
                {selectedCustomer.phone ? <span className="muted"> · {selectedCustomer.phone}</span> : null}
                {selectedCustomer.email ? <span className="muted"> · {selectedCustomer.email}</span> : null}
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSelectedCustomer(null);
                  setSelectedPropertyId('');
                  setCustomerQuery('');
                }}
              >
                Change customer
              </button>
            </div>
          )}
        </section>

        <section className="job-create-section">
          <h4>2. Property / service location</h4>
          {selectedCustomer && selectedCustomer.properties.length > 0 && !creatingNewProperty ? (
            <>
              <label htmlFor="property-select">Saved properties</label>
              <select
                id="property-select"
                className="input"
                value={selectedPropertyId}
                onChange={(e) => {
                  const property = selectedCustomer.properties.find((p) => p.id === e.target.value);
                  if (property) applyProperty(property);
                }}
              >
                {selectedCustomer.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {propertyLabel(property)}
                  </option>
                ))}
              </select>
              <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => {
                setCreatingNewProperty(true);
                setSelectedPropertyId('');
                setAddressMode('save_new_property');
                setAddress('');
                setStructuredAddress(null);
                setNewPropertyName('');
                setAccessInstructions('');
              }}>
                Add another property
              </button>
            </>
          ) : null}

          {(creatingNewProperty || !selectedCustomer || selectedCustomer.properties.length === 0) && selectedCustomer ? (
            <div className="form-group" style={{ marginTop: 8 }}>
              <label>New property name</label>
              <input className="input" value={newPropertyName} onChange={(e) => setNewPropertyName(e.target.value)} placeholder="Home, Airbnb, Office…" />
            </div>
          ) : null}

          <div style={{ marginTop: 12 }}>
            <AddressAutocomplete
              id="job-address"
              label="Service address"
              value={address}
              onChange={(formatted, structured) => {
                setAddress(formatted);
                setStructuredAddress(structured);
                if (selectedPropertyId && !creatingNewProperty) {
                  setAddressMode('job_only');
                } else if (selectedCustomer) {
                  setAddressMode('save_new_property');
                }
              }}
              onSelect={(suggestion) => {
                void resolveTimezoneFromCoords(suggestion.latitude, suggestion.longitude);
              }}
            />
          </div>

          {selectedPropertyId && addressChangedFromProperty ? (
            <fieldset style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
              <legend>Address changed</legend>
              <p className="muted">Choose how to use this address. Saved property data is never overwritten silently.</p>
              <label style={{ display: 'block' }}>
                <input
                  type="radio"
                  name="address-mode"
                  checked={addressMode === 'job_only'}
                  onChange={() => setAddressMode('job_only')}
                />{' '}
                Use only for this job
              </label>
              <label style={{ display: 'block' }}>
                <input
                  type="radio"
                  name="address-mode"
                  checked={addressMode === 'save_new_property'}
                  onChange={() => {
                    setAddressMode('save_new_property');
                    setCreatingNewProperty(true);
                    setNewPropertyName(newPropertyName || 'New property');
                  }}
                />{' '}
                Save as a new property
              </label>
              <label style={{ display: 'block' }}>
                <input
                  type="radio"
                  name="address-mode"
                  checked={addressMode === 'update_selected_property'}
                  onChange={() => setAddressMode('update_selected_property')}
                />{' '}
                Update the selected property
              </label>
            </fieldset>
          ) : null}

          <details style={{ marginTop: 12 }} open={showAdvancedProperty} onToggle={(e) => setShowAdvancedProperty((e.target as HTMLDetailsElement).open)}>
            <summary>Access instructions and notes</summary>
            <label style={{ marginTop: 10 }}>Access instructions</label>
            <textarea className="input" rows={3} value={accessInstructions} onChange={(e) => setAccessInstructions(e.target.value)} />
            <p className="muted">Gate and lockbox codes stay on the property record. They are not shown in search previews or notifications.</p>
          </details>
        </section>

        <section className="job-create-section">
          <h4>3. Job details</h4>
          <label>Job title *</label>
          <input className="input" placeholder="Example: Move-out cleaning" value={title} onChange={(e) => setTitle(e.target.value)} required />
          {selectedCustomer ? null : (
            <div className="grid-2">
              <div className="form-group"><label>Customer name</label><input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
              <div className="form-group"><label>Phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
          )}
        </section>

        <section className="job-create-section">
          <h4>4. Days and hours</h4>
          <p className="muted">Add one or more scheduled visits. Times are saved in the timezone selected below.</p>
          <label htmlFor="job-timezone">Job timezone</label>
          <select id="job-timezone" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
            <option value="">Use workspace default</option>
            {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <p className="muted">Timezone is filled from the property address when available.</p>
          {visits.map((visit, index) => (
            <div key={visit.id} className="form visit-editor">
              <label>Visit {index + 1}</label>
              <input className="input" type="date" value={visit.visit_date} onChange={(e) => updateVisit(visit.id, { visit_date: e.target.value })} />
              <div className="grid-2">
                <div className="form-group"><label>Start time</label><input className="input" type="time" value={visit.start_time} onChange={(e) => updateVisit(visit.id, { start_time: e.target.value })} /></div>
                <div className="form-group"><label>End time</label><input className="input" type="time" value={visit.end_time} onChange={(e) => updateVisit(visit.id, { end_time: e.target.value })} /></div>
              </div>
              <label>Visit notes</label>
              <input className="input" value={visit.notes} onChange={(e) => updateVisit(visit.id, { notes: e.target.value })} />
              {visits.length > 1 ? <button className="btn" type="button" onClick={() => removeVisit(visit.id)}>Remove visit</button> : null}
            </div>
          ))}
          <button className="btn" type="button" onClick={() => setVisits((rows) => [...rows, newVisit()])}>Add another visit</button>
        </section>

        <section className="job-create-section">
          <h4>Assignment and notes</h4>
          <label htmlFor="assigned-to">Assign to</label>
          <select id="assigned-to" className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} disabled={loadingTeam}>
            <option value="">Unassigned</option>
            {teamMembers.map((member) => <option key={member.userId} value={member.userId}>{member.label} · {roleLabel(member.role)}</option>)}
          </select>
          <label>Job notes</label>
          <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>

        <section className="job-create-section">
          <h4>Client income</h4>
          <p className="muted">What the client will pay your business. This is separate from contractor pay.</p>
          <label>Client income amount</label>
          <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={clientIncome} onChange={(e) => setClientIncome(e.target.value)} />
        </section>

        <section className="job-create-section">
          <h4>Initial contractor pay</h4>
          <p className="muted">Optional. Choose hourly or flat-rate pay so the calculation is clear.</p>
          <label>Contractor or cleaner name</label>
          <input className="input" value={contractorName} onChange={(e) => setContractorName(e.target.value)} />
          <label>Pay type</label>
          <div className="segmented-control" role="group" aria-label="Contractor pay type">
            <button type="button" className={`btn${contractorPayMode === 'hourly' ? ' btn-primary' : ''}`} onClick={() => setContractorPayMode('hourly')}>Hourly pay</button>
            <button type="button" className={`btn${contractorPayMode === 'flat' ? ' btn-primary' : ''}`} onClick={() => setContractorPayMode('flat')}>Flat-rate pay</button>
          </div>
          {contractorPayMode === 'hourly' ? (
            <div className="grid-2">
              <div className="form-group"><label>Hours</label><input className="input" type="number" min="0" step="0.25" value={contractorHours} onChange={(e) => setContractorHours(e.target.value)} /></div>
              <div className="form-group"><label>Hourly rate</label><input className="input" type="number" min="0" step="0.01" value={contractorHourlyRate} onChange={(e) => setContractorHourlyRate(e.target.value)} /></div>
            </div>
          ) : (
            <div className="form-group"><label>Flat-rate amount</label><input className="input" type="number" min="0" step="0.01" value={contractorFlatRate} onChange={(e) => setContractorFlatRate(e.target.value)} /></div>
          )}
          <label>Contractor pay notes</label>
          <input className="input" value={contractorNotes} onChange={(e) => setContractorNotes(e.target.value)} />
          <div className="finance-metric-grid financials-summary-grid">
            <div className="finance-metric"><span className="finance-metric-label">Initial contractor pay</span><strong>${previewContractorPay.toFixed(2)}</strong></div>
            <div className="finance-metric featured"><span className="finance-metric-label">Estimated profit</span><strong>${previewProfit.toFixed(2)}</strong></div>
          </div>
        </section>

        <section className="job-create-section">
          <h4>Initial photos</h4>
          <p className="muted">Optional before photos. You can edit or add more photos after the job is created.</p>
          <input className="input" type="file" accept="image/*" multiple onChange={(e) => setInitialPhotos(Array.from(e.target.files || []))} />
          {initialPhotos.length > 0 ? <p className="muted">{initialPhotos.length} photo{initialPhotos.length === 1 ? '' : 's'} selected</p> : null}
        </section>

        <Button className="btn-primary unified-job-save" type="submit" disabled={loading}>
          {loading ? FEEDBACK.loading : 'Save job'}
        </Button>
      </form>
    </div>
  );
}
