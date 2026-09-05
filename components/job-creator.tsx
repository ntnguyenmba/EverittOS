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
import { calculateExpectedJobFinance, multiplyMoneyDollars, parseMoneyDollars } from '@/lib/money-decimal';
import { getBillingOpsCopy } from '@/lib/i18n/billing-ops-copy';
import { getJobCreateCopy } from '@/lib/i18n/job-create-copy';
import { getRecurrenceCopy } from '@/lib/i18n/recurrence-copy';
import {
  RECURRING_GENERATION_WINDOW_DAYS,
  summarizeRecurrenceForLocale,
  type RecurrenceEndMode,
  type RecurrenceFrequency,
  type RecurrenceIntervalUnit
} from '@/lib/recurring-jobs';

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
type CustomerEntryMode = 'existing' | 'new';

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
  return parseMoneyDollars(value);
}

function durationHoursValue(value: string): number | null {
  const hours = Number(value);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

function endFromDuration(date: string, startTime: string, hours: number) {
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = startTime.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch || !Number.isFinite(hours) || hours <= 0) return null;
  const start = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2])
  );
  const end = new Date(start + Math.round(hours * 60) * 60_000);
  return {
    date: `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`,
    time: `${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`
  };
}

function hoursBetweenTimes(startTime: string, endTime: string): number | null {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return null;
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

/** Blank → null; intentional "0" → 0. Never use `value || null` for money. */
function optionalMoneyInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return moneyValue(trimmed);
}

function propertyLabel(property: PropertyOption, fallbackType: string, noAddress: string) {
  const type = (property.property_type || 'home') as PropertyType;
  const typeLabel = PROPERTY_TYPE_LABELS[type] || fallbackType;
  const address = property.display_address || property.formatted_address || property.address || noAddress;
  return `${property.name} · ${typeLabel} · ${address}`;
}

export function JobCreator({ onJobCreated }: JobCreatorProps) {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [structuredAddress, setStructuredAddress] = useState<StructuredAddress | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('none');
  const [recurrenceStartDate, setRecurrenceStartDate] = useState('');
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([new Date().getDay()]);
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [recurrenceIntervalUnit, setRecurrenceIntervalUnit] = useState<RecurrenceIntervalUnit>('weeks');
  const [recurrenceEndMode, setRecurrenceEndMode] = useState<RecurrenceEndMode>('never');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceLimit, setRecurrenceLimit] = useState('');
  const [showRecurrenceAdvanced, setShowRecurrenceAdvanced] = useState(false);
  const [recurrenceFieldErrors, setRecurrenceFieldErrors] = useState<{
    startDate?: string;
    weekdays?: string;
    endDate?: string;
    limit?: string;
    startTime?: string;
  }>({});
  const [timeZone, setTimeZone] = useState('');
  const [clientIncome, setClientIncome] = useState('');
  const [additionalExpenses, setAdditionalExpenses] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [contractorPayMode, setContractorPayMode] = useState<ContractorPayMode>('flat');
  const [jobDurationHours, setJobDurationHours] = useState('');
  const [allDay, setAllDay] = useState(false);
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
  const [customerMode, setCustomerMode] = useState<CustomerEntryMode | null>(
    searchParams.get('customerId') || searchParams.get('customer_id') ? 'existing' : null
  );
  const [addressMode, setAddressMode] = useState<AddressMode>('job_only');
  const [showAdvancedProperty, setShowAdvancedProperty] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadDone = useRef(false);

  const appFeedback = useAppFeedback();
  const { t, locale } = useTranslation();
  const recurrenceCopy = getRecurrenceCopy(locale);
  const createCopy = getJobCreateCopy(locale);

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
      .select('id, company_name, contact_name, email, phone')
      .eq('id', customerId)
      .maybeSingle();

    const propsRes = await fetch(`/api/customers/${customerId}/properties`);
    const propsJson = (await propsRes.json().catch(() => ({}))) as { properties?: PropertyOption[] };

    if (!customer) return;

    const option: CustomerOption = {
      id: customer.id,
      name: customer.company_name || customer.contact_name || customer.email || 'Customer',
      email: customer.email,
      phone: customer.phone,
      company_name: customer.company_name,
      properties: (propsJson.properties || []).map((p) => ({
        ...p,
        display_address: p.formatted_address || p.address || null
      }))
    };
    setCustomerEmail(customer.email || '');
    applyCustomer(option, propertyId);
  }

  function applyCustomer(customer: CustomerOption, propertyId?: string) {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.name);
    setCustomerName(customer.name);
    setCustomerEmail(customer.email || '');
    setPhone(customer.phone || '');
    setCustomerResults([]);
    setCreatingNewProperty(false);
    setCustomerMode('existing');

    const preferred =
      (propertyId && customer.properties.find((p) => p.id === propertyId)) ||
      (customer.properties.length === 1 ? customer.properties[0] : null);

    if (preferred) {
      applyProperty(preferred);
    } else if (customer.properties.length > 1) {
      setSelectedPropertyId('');
      setCreatingNewProperty(false);
      setAddress('');
      setStructuredAddress(null);
      setAccessInstructions('');
    } else {
      setSelectedPropertyId('');
      setCreatingNewProperty(true);
      setAddressMode('save_new_property');
      setNewPropertyName(createCopy.propertyNamePlaceholder);
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
    if (property.default_duration_minutes != null && !jobDurationHours) {
      const hours = property.default_duration_minutes / 60;
      setJobDurationHours(String(hours));
      setVisits((rows) =>
        rows.map((visit, index) => {
          if (index !== 0 || !visit.visit_date || !visit.start_time) return visit;
          const end = endFromDuration(visit.visit_date, visit.start_time, hours);
          return end ? { ...visit, end_time: end.time } : visit;
        })
      );
    }
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

  function resetCustomerDraft() {
    setSelectedCustomer(null);
    setSelectedPropertyId('');
    setCustomerQuery('');
    setCustomerResults([]);
    setCustomerName('');
    setCustomerEmail('');
    setPhone('');
    setAddress('');
    setStructuredAddress(null);
    setAccessInstructions('');
    setNewPropertyName('');
    setCreatingNewProperty(false);
    setAddressMode('job_only');
    setShowAdvancedProperty(false);
  }

  function chooseExistingCustomer() {
    if (customerMode !== 'existing') resetCustomerDraft();
    setCustomerMode('existing');
  }

  function chooseNewCustomer() {
    if (customerMode !== 'new') resetCustomerDraft();
    setCustomerMode('new');
    setCreatingNewProperty(true);
    setAddressMode('save_new_property');
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
    }
  }

  function updateVisit(id: string, patch: Partial<VisitDraft>) {
    setVisits((rows) => rows.map((visit) => (visit.id === id ? { ...visit, ...patch } : visit)));
  }

  function setPrimaryDuration(value: string) {
    setJobDurationHours(value);
    const hours = durationHoursValue(value);
    if (!hours) return;
    setVisits((rows) =>
      rows.map((visit, index) => {
        if (index !== 0 || !visit.visit_date || !visit.start_time) return visit;
        const end = endFromDuration(visit.visit_date, visit.start_time, hours);
        return end ? { ...visit, end_time: end.time } : visit;
      })
    );
  }

  function setPrimaryStartTime(value: string) {
    setAllDay(false);
    setRecurrenceFieldErrors((current) => ({ ...current, startTime: undefined }));
    const hours = durationHoursValue(jobDurationHours);
    setVisits((rows) =>
      rows.map((visit, index) => {
        if (index !== 0) return visit;
        const end = hours && visit.visit_date ? endFromDuration(visit.visit_date, value, hours) : null;
        return { ...visit, start_time: value, ...(end ? { end_time: end.time } : {}) };
      })
    );
  }

  function setPrimaryEndTime(value: string) {
    setAllDay(false);
    setVisits((rows) =>
      rows.map((visit, index) => {
        if (index !== 0) return visit;
        const hours = visit.start_time && value ? hoursBetweenTimes(visit.start_time, value) : null;
        if (hours) setJobDurationHours(String(hours));
        return { ...visit, end_time: value };
      })
    );
  }

  function applyAllDay() {
    setAllDay(true);
    setJobDurationHours('9');
    setVisits((rows) => {
      if (!rows[0]) return [{ ...newVisit(), start_time: '08:00', end_time: '17:00' }];
      return rows.map((visit, index) => (index === 0 ? { ...visit, start_time: '08:00', end_time: '17:00' } : visit));
    });
  }

  function setSeriesStartDate(value: string) {
    setRecurrenceStartDate(value);
    setRecurrenceFieldErrors((current) => ({ ...current, startDate: undefined }));
    setVisits((rows) => {
      if (!rows[0]) return [{ ...newVisit(), visit_date: value }];
      return rows.map((visit, index) => (index === 0 ? { ...visit, visit_date: value } : visit));
    });
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

  async function ensurePropertyForJob(customerId: string, options?: { forceNew?: boolean }): Promise<string | null> {
    const forceNew = Boolean(options?.forceNew) || addressMode === 'save_new_property' || creatingNewProperty;

    if (selectedPropertyId && !forceNew) {
      if (addressMode === 'update_selected_property' && structuredAddress) {
        const updateRes = await fetch(`/api/customers/${customerId}/properties/${selectedPropertyId}`, {
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
        if (!updateRes.ok) {
          const updateJson = (await updateRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(updateJson.error || 'Unable to update property address.');
        }
      }
      return selectedPropertyId;
    }

    if (forceNew) {
      if (!address.trim()) throw new Error(createCopy.addServiceAddress);
      const name = newPropertyName.trim() || createCopy.propertyNamePlaceholder;
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
      if (!res.ok || !json.property?.id) throw new Error(json.error || createCopy.unableToSaveProperty);
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

    if (selectedCustomer && selectedCustomer.properties.length > 1 && !selectedPropertyId && !creatingNewProperty) {
      appFeedback.error(createCopy.selectPropertyRequired);
      return;
    }

    const isRecurringJob = recurrenceFrequency !== 'none';
    if (isRecurringJob) {
      const needsWeekdays =
        recurrenceFrequency === 'weekly' ||
        recurrenceFrequency === 'biweekly' ||
        recurrenceFrequency === 'every_three_weeks' ||
        recurrenceFrequency === 'every_four_weeks' ||
        (recurrenceFrequency === 'custom' && recurrenceIntervalUnit === 'weeks');
      const nextErrors: typeof recurrenceFieldErrors = {};
      if (!recurrenceStartDate.trim()) nextErrors.startDate = recurrenceCopy.startDateRequired;
      if (needsWeekdays && recurrenceWeekdays.length === 0) nextErrors.weekdays = recurrenceCopy.selectWeekday;
      if (recurrenceEndMode === 'on_date') {
        if (!recurrenceEndDate.trim()) nextErrors.endDate = recurrenceCopy.endDateRequired;
        else if (recurrenceStartDate && recurrenceEndDate < recurrenceStartDate) nextErrors.endDate = recurrenceCopy.endDateBeforeStart;
      }
      if (recurrenceEndMode === 'after_count') {
        const count = Number(recurrenceLimit);
        if (!recurrenceLimit.trim() || !Number.isFinite(count) || count < 1) nextErrors.limit = recurrenceCopy.occurrenceCountRequired;
      }
      if (!visits[0]?.start_time) nextErrors.startTime = recurrenceCopy.startTimeRequired;
      if (Object.keys(nextErrors).length > 0) {
        setRecurrenceFieldErrors(nextErrors);
        return;
      }
      setRecurrenceFieldErrors({});
    }

    const scheduledVisits = isRecurringJob
      ? [{ ...(visits[0] || newVisit()), visit_date: recurrenceStartDate.trim(), start_time: visits[0]?.start_time || '', end_time: visits[0]?.end_time || '' }]
      : validVisits(visits);

    for (const visit of scheduledVisits) {
      if (isRecurringJob) {
        if (!visit.visit_date || !visit.start_time) {
          setRecurrenceFieldErrors((current) => ({
            ...current,
            startDate: visit.visit_date ? current.startDate : recurrenceCopy.startDateRequired,
            startTime: visit.start_time ? current.startTime : recurrenceCopy.startTimeRequired
          }));
          return;
        }
      } else if (!visit.visit_date || !visit.start_time || !visit.end_time) {
        appFeedback.error('Each visit needs a date, start time, and end time.');
        return;
      }
      if (visit.start_time && visit.end_time && visit.end_time <= visit.start_time) {
        appFeedback.error('Pick an end time later the same day, or tap All day.');
        return;
      }
    }

    const hasContractorPay =
      contractorPayMode === 'hourly'
        ? Boolean(contractorHours.trim() || contractorHourlyRate.trim())
        : Boolean(contractorFlatRate.trim());

    if (hasContractorPay && contractorPayMode === 'hourly') {
      const hours = moneyValue(contractorHours);
      const rate = moneyValue(contractorHourlyRate);
      if (!Number.isFinite(hours) || hours < 0 || !Number.isFinite(rate) || rate < 0) {
        appFeedback.error('Enter valid worker hours and hourly rate.');
        return;
      }
    }
    if (hasContractorPay && contractorPayMode === 'flat') {
      const flat = moneyValue(contractorFlatRate);
      if (!Number.isFinite(flat) || flat < 0) {
        appFeedback.error('Enter a valid worker price.');
        return;
      }
    }
    if (clientIncome.trim()) {
      const clientPay = moneyValue(clientIncome);
      if (!Number.isFinite(clientPay) || clientPay < 0) {
        appFeedback.error('Enter a valid customer price.');
        return;
      }
    }
    if (additionalExpenses.trim()) {
      const expense = moneyValue(additionalExpenses);
      if (!Number.isFinite(expense) || expense < 0) {
        appFeedback.error('Enter a valid additional expense amount.');
        return;
      }
    }

    const firstVisit = scheduledVisits[0];
    const lastVisit = scheduledVisits[scheduledVisits.length - 1];
    const selectedDurationHours = durationHoursValue(jobDurationHours);
    const primaryEnd =
      firstVisit && selectedDurationHours
        ? endFromDuration(firstVisit.visit_date, firstVisit.start_time, selectedDurationHours)
        : null;
    const scheduledStart = firstVisit ? wallClockDateTime(firstVisit.visit_date, firstVisit.start_time) : null;
    const scheduledEnd =
      scheduledVisits.length === 1 && primaryEnd
        ? wallClockDateTime(primaryEnd.date, primaryEnd.time)
        : lastVisit
          ? wallClockDateTime(lastVisit.visit_date, lastVisit.end_time)
          : null;

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
    let autoLinkedCustomer = false;

    try {
      const creatingNewCustomer = customerMode === 'new' && !selectedCustomer && Boolean(customerName.trim());
      if (creatingNewCustomer) {
        const createCustomerRes = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: customerName.trim(),
            email: customerEmail.trim() || null,
            phone: phone.trim() || null,
            address: address.trim() || null,
            record_type: 'customer',
            pipeline_stage: 'active'
          })
        });
        const createCustomerJson = (await createCustomerRes.json().catch(() => ({}))) as { customer?: { id: string }; error?: string };
        if (!createCustomerRes.ok || !createCustomerJson.customer?.id) throw new Error(createCustomerJson.error || createCopy.unableToCreateCustomer);
        customerId = createCustomerJson.customer.id;
        autoLinkedCustomer = true;
      }

      const needsNewProperty =
        Boolean(address.trim()) &&
        (creatingNewCustomer || autoLinkedCustomer || creatingNewProperty) &&
        !(selectedPropertyId && !creatingNewProperty);

      if (customerId && selectedPropertyId && !creatingNewProperty && !needsNewProperty) {
        propertyId = await ensurePropertyForJob(customerId, { forceNew: false });
      } else if (customerId && needsNewProperty) {
        propertyId = await ensurePropertyForJob(customerId, { forceNew: true });
        if (!propertyId) throw new Error(createCopy.unableToSaveProperty);
      } else if (customerId && (selectedPropertyId || addressMode === 'update_selected_property')) {
        propertyId = await ensurePropertyForJob(customerId);
      }
    } catch (error) {
      setLoading(false);
      appFeedback.error(error instanceof Error ? error.message : createCopy.prepareCustomerProperty);
      return;
    }

    const expectedContractorPay =
      contractorPayMode === 'hourly'
        ? hasContractorPay
          ? multiplyMoneyDollars(contractorHourlyRate, contractorHours)
          : null
        : optionalMoneyInput(contractorFlatRate);
    const assignedMember = teamMembers.find((member) => member.userId === assignedTo);
    const resolvedContractorName = assignedMember?.label || 'Unassigned worker';
    const durationMinutes = selectedDurationHours
      ? Math.round(selectedDurationHours * 60)
      : firstVisit?.start_time && firstVisit?.end_time
        ? Math.round((hoursBetweenTimes(firstVisit.start_time, firstVisit.end_time) || 0) * 60)
        : null;

    if (recurrenceFrequency !== 'none') {
      const startDate = recurrenceStartDate.trim();
      const recurringRes = await fetch('/api/recurring-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          customer_id: customerId,
          property_id: propertyId,
          customer_name: customerName.trim() || null,
          customer_email: customerEmail.trim() || null,
          customer_phone: phone.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
          timezone: timeZone || null,
          default_price: optionalMoneyInput(clientIncome),
          expected_contractor_cost: expectedContractorPay,
          expected_additional_expense: optionalMoneyInput(additionalExpenses),
          expected_expense_description: expenseDescription.trim() || null,
          contractor_pay_basis: contractorPayMode,
          contractor_hours: contractorPayMode === 'hourly' && contractorHours.trim() ? moneyValue(contractorHours) : null,
          contractor_hourly_rate:
            contractorPayMode === 'hourly' && contractorHourlyRate.trim()
              ? moneyValue(contractorHourlyRate)
              : contractorPayMode === 'flat'
                ? expectedContractorPay
                : null,
          contractor_name: assignedTo ? resolvedContractorName : null,
          duration_minutes: durationMinutes,
          assigned_to: assignedTo || null,
          recurrence: {
            frequency: recurrenceFrequency,
            interval: Number(recurrenceInterval) || 1,
            intervalUnit: recurrenceIntervalUnit,
            weekday: recurrenceWeekdays[0] ?? null,
            weekdays: recurrenceWeekdays,
            startDate,
            endMode: recurrenceEndMode,
            endDate: recurrenceEndMode === 'on_date' ? recurrenceEndDate || null : null,
            occurrenceLimit: recurrenceEndMode === 'after_count' && recurrenceLimit ? Number(recurrenceLimit) : null,
            preferredStartTime: firstVisit?.start_time || null
          }
        })
      });
      const recurringJson = (await recurringRes.json().catch(() => ({}))) as { firstJobId?: string; job?: { id: string }; error?: string; summary?: string };
      setLoading(false);
      if (!recurringRes.ok || !(recurringJson.firstJobId || recurringJson.job?.id)) {
        appFeedback.error(recurringJson.error || 'Unable to create recurring jobs.');
        return;
      }
      appFeedback.success(recurringJson.summary || 'Recurring series created.');
      onJobCreated?.(recurringJson.firstJobId || recurringJson.job!.id);
      return;
    }

    const jobNotes = [notes.trim(), contractorNotes.trim() ? `Worker pay notes: ${contractorNotes.trim()}` : '']
      .filter(Boolean)
      .join('\n\n');

    const createRes = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        customer_name: customerName.trim() || null,
        customer_email: customerEmail.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: jobNotes || null,
        timezone: timeZone || null,
        customer_id: customerId,
        property_id: propertyId,
        revenue_amount: optionalMoneyInput(clientIncome),
        expected_contractor_cost: expectedContractorPay,
        expected_additional_expense: optionalMoneyInput(additionalExpenses),
        expected_expense_description: expenseDescription.trim() || null,
        assigned_to: assignedTo || null,
        start_date: firstVisit?.visit_date || null,
        due_date: scheduledVisits.length === 1 && primaryEnd ? primaryEnd.date : lastVisit?.visit_date || null,
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

    if (initialPhotos.length > 0) {
      followUpTasks.push(
        uploadInitialPhotos(jobId, org.organizationId, user.id, profile?.full_name || profile?.email || user.email || 'Team member')
      );
    }

    const followUpResults = await Promise.allSettled(followUpTasks);
    const failedFollowUp = followUpResults.find((result) => result.status === 'rejected');
    if (failedFollowUp?.status === 'rejected') {
      setLoading(false);
      appFeedback.error(
        failedFollowUp.reason instanceof Error
          ? failedFollowUp.reason.message
          : 'Job saved, but one or more financial details could not be saved.'
      );
      return;
    }

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

  const previewFinance = calculateExpectedJobFinance({
    clientPrice: clientIncome,
    contractorPay: contractorPayMode === 'hourly' ? multiplyMoneyDollars(contractorHourlyRate, contractorHours) : contractorFlatRate,
    additionalExpenses
  });
  const previewContractorPay = previewFinance.expectedContractorCost;
  const previewProfit = previewFinance.expectedProfit;
  const isRecurring = recurrenceFrequency !== 'none';
  const primaryVisit = visits[0];
  const recurrenceSummary = summarizeRecurrenceForLocale(
    {
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
    },
    locale
  );
  const showWeekdays =
    isRecurring &&
    (recurrenceFrequency === 'weekly' ||
      recurrenceFrequency === 'biweekly' ||
      recurrenceFrequency === 'every_three_weeks' ||
      recurrenceFrequency === 'every_four_weeks' ||
      (recurrenceFrequency === 'custom' && recurrenceIntervalUnit === 'weeks'));
  const weekdayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const selectedProperty = selectedCustomer?.properties.find((p) => p.id === selectedPropertyId) || null;

  return (
    <div className="card">
      <h3>{t('pages.jobs.createTitle')}</h3>
      <p className="muted">{createCopy.intro}</p>
      <form className="form unified-job-form" onSubmit={createJob}>
        <section className="job-create-section">
          <h4>{createCopy.customerHeading}</h4>
          <div className="job-customer-mode" role="group" aria-label={createCopy.customerChoice}>
            <button type="button" aria-pressed={customerMode === 'existing'} onClick={chooseExistingCustomer}>
              {createCopy.existingCustomer}
            </button>
            <button type="button" aria-pressed={customerMode === 'new'} onClick={chooseNewCustomer}>
              {createCopy.newCustomer}
            </button>
          </div>

          {customerMode === 'existing' ? (
            <>
              <label htmlFor="customer-search">{createCopy.searchCustomers}</label>
              <input
                id="customer-search"
                className="input"
                value={customerQuery}
                placeholder={createCopy.searchPlaceholder}
                autoComplete="off"
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  if (selectedCustomer) setSelectedCustomer(null);
                }}
              />
              {customerSearching ? <p className="muted" role="status">{createCopy.searching}</p> : null}
              {customerResults.length > 0 ? (
                <div role="listbox" aria-label={createCopy.customerMatches} style={{ border: '1px solid var(--line)', borderRadius: 12, marginTop: 8 }}>
                  {customerResults.map((customer) => {
                    const contactLine = customer.email || customer.phone || null;
                    const property = customer.properties[0];
                    const propertyLine = property
                      ? [property.name, property.display_address || property.formatted_address || property.address].filter(Boolean).join(' · ')
                      : customer.address || null;
                    return (
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
                        {contactLine ? <span className="muted" style={{ display: 'block' }}>{contactLine}</span> : null}
                        {propertyLine ? <span className="muted" style={{ display: 'block', fontSize: '0.92em' }}>{propertyLine}</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {selectedCustomer ? (
                <div
                  className="client-summary-card"
                  style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: 'var(--surface-subtle, var(--surface))' }}
                >
                  <p style={{ margin: 0 }}><strong>{selectedCustomer.name}</strong></p>
                  <p className="muted" style={{ margin: '4px 0 0' }}>{createCopy.email}: {customerEmail || selectedCustomer.email || createCopy.notOnFile}</p>
                  <p className="muted" style={{ margin: '4px 0 0' }}>{createCopy.phone}: {phone || selectedCustomer.phone || createCopy.notOnFile}</p>
                  {selectedCustomer.company_name ? <p className="muted" style={{ margin: '4px 0 0' }}>{createCopy.company}: {selectedCustomer.company_name}</p> : null}
                  {selectedProperty && !creatingNewProperty ? (
                    <p className="muted" style={{ margin: '4px 0 0' }}>{createCopy.serviceAddress}: {address || createCopy.noAddress}</p>
                  ) : null}
                  <button
                    type="button"
                    className="btn"
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      resetCustomerDraft();
                      setCustomerMode('existing');
                    }}
                  >
                    {createCopy.changeCustomer}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {customerMode === 'new' ? (
            <div className="grid-2" style={{ marginTop: 12 }}>
              <div className="form-group"><label htmlFor="new-customer-name">{createCopy.customerName}</label><input id="new-customer-name" className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
              <div className="form-group"><label htmlFor="new-customer-email">{createCopy.email}</label><input id="new-customer-email" className="input" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
              <div className="form-group"><label htmlFor="new-customer-phone">{createCopy.phone}</label><input id="new-customer-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
          ) : null}
        </section>

        {customerMode === 'existing' && selectedCustomer ? (
          <section className="job-create-section">
            <h4>{createCopy.propertyHeading}</h4>
            {selectedCustomer.properties.length > 1 && !selectedPropertyId && !creatingNewProperty ? <p className="muted">{createCopy.multipleProperties}</p> : null}
            {selectedCustomer.properties.length > 0 && !creatingNewProperty ? (
              <>
                <label htmlFor="property-select">{createCopy.savedProperties}</label>
                <select
                  id="property-select"
                  className="input"
                  value={selectedPropertyId}
                  required={selectedCustomer.properties.length > 1}
                  onChange={(e) => {
                    const property = selectedCustomer.properties.find((p) => p.id === e.target.value);
                    if (property) applyProperty(property);
                  }}
                >
                  {selectedCustomer.properties.length > 1 ? <option value="">{createCopy.selectProperty}</option> : null}
                  {selectedCustomer.properties.map((property) => (
                    <option key={property.id} value={property.id}>{propertyLabel(property, createCopy.noProperty, createCopy.noAddress)}</option>
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
                }}>{createCopy.addAnotherProperty}</button>
              </>
            ) : null}

            {creatingNewProperty || selectedCustomer.properties.length === 0 ? (
              <>
                {selectedCustomer.properties.length > 0 ? (
                  <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => {
                    setCreatingNewProperty(false);
                    setAddressMode('job_only');
                    const preferred = selectedCustomer.properties.length === 1 ? selectedCustomer.properties[0] : null;
                    if (preferred) applyProperty(preferred);
                    else {
                      setSelectedPropertyId('');
                      setAddress('');
                      setStructuredAddress(null);
                    }
                  }}>{createCopy.useSavedProperty}</button>
                ) : null}
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label htmlFor="property-name">{createCopy.propertyName}</label>
                  <input id="property-name" className="input" value={newPropertyName} onChange={(e) => setNewPropertyName(e.target.value)} placeholder={createCopy.propertyNamePlaceholder} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <AddressAutocomplete
                    id="job-address"
                    label={createCopy.serviceAddress}
                    placeholder={createCopy.addressPlaceholder}
                    value={address}
                    onChange={(formatted, structured) => {
                      setAddress(formatted);
                      setStructuredAddress(structured);
                      setAddressMode('save_new_property');
                    }}
                    onSelect={(suggestion) => void resolveTimezoneFromCoords(suggestion.latitude, suggestion.longitude)}
                  />
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {customerMode === 'new' ? (
          <section className="job-create-section">
            <h4>{createCopy.propertyHeading}</h4>
            <div className="form-group" style={{ marginTop: 8 }}>
              <label htmlFor="property-name">{createCopy.propertyName}</label>
              <input id="property-name" className="input" value={newPropertyName} onChange={(e) => setNewPropertyName(e.target.value)} placeholder={createCopy.propertyNamePlaceholder} />
            </div>
            <div style={{ marginTop: 12 }}>
              <AddressAutocomplete
                id="job-address"
                label={createCopy.serviceAddress}
                placeholder={createCopy.addressPlaceholder}
                value={address}
                onChange={(formatted, structured) => {
                  setAddress(formatted);
                  setStructuredAddress(structured);
                  setAddressMode('save_new_property');
                }}
                onSelect={(suggestion) => void resolveTimezoneFromCoords(suggestion.latitude, suggestion.longitude)}
              />
            </div>
          </section>
        ) : null}

        <section className="job-create-section">
          <h4>3. Job details</h4>
          <label>Job title *</label>
          <input className="input" placeholder="Example: Move-out cleaning" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </section>

        <section className="job-create-section">
          <h4>{recurrenceCopy.scheduleHeading}</h4>
          <label htmlFor="recurrence-starts-on">{isRecurring ? recurrenceCopy.startsOn : 'Date'}</label>
          <input
            id="recurrence-starts-on"
            name="recurrence_starts_on"
            className="input"
            type="date"
            required={isRecurring}
            aria-required={isRecurring ? 'true' : undefined}
            aria-invalid={Boolean(recurrenceFieldErrors.startDate)}
            value={primaryVisit?.visit_date || recurrenceStartDate}
            onChange={(e) => setSeriesStartDate(e.target.value)}
          />
          {recurrenceFieldErrors.startDate ? <p className="auth-message auth-message-error" role="alert">{recurrenceFieldErrors.startDate}</p> : null}
          <div className="grid-2" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label htmlFor="job-start-time">{recurrenceCopy.startTime}</label>
              <input
                id="job-start-time"
                className="input"
                type="time"
                aria-invalid={Boolean(recurrenceFieldErrors.startTime)}
                value={primaryVisit?.start_time || ''}
                onChange={(e) => {
                  if (!primaryVisit) return;
                  setPrimaryStartTime(e.target.value);
                }}
              />
              {recurrenceFieldErrors.startTime ? <p className="auth-message auth-message-error" role="alert">{recurrenceFieldErrors.startTime}</p> : null}
            </div>
            <div className="form-group">
              <label htmlFor="job-end-time">{recurrenceCopy.endTime}</label>
              <input id="job-end-time" className="input" type="time" value={primaryVisit?.end_time || ''} onChange={(e) => primaryVisit && setPrimaryEndTime(e.target.value)} />
            </div>
          </div>
          <div className="button-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className={`btn${allDay ? ' btn-primary' : ''}`} aria-pressed={allDay} onClick={() => applyAllDay()}>
              All day
            </button>
          </div>
          <p className="muted">All day is 8:00 AM to 5:00 PM. Or pick any start and end time on this date.</p>
        </section>

        <section className="job-create-section">
          <h4>5. Customer price</h4>
          <p className="muted">This is what the customer will pay for this job.</p>
          <label>Customer price</label>
          <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={clientIncome} onChange={(e) => setClientIncome(e.target.value)} />
        </section>

        <section className="job-create-section">
          <h4>6. Worker</h4>
          <label htmlFor="assigned-to">Assign worker</label>
          <select id="assigned-to" className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} disabled={loadingTeam}>
            <option value="">Unassigned</option>
            {teamMembers.map((member) => <option key={member.userId} value={member.userId}>{member.label} · {roleLabel(member.role)}</option>)}
          </select>
          <label style={{ marginTop: 16 }}>Worker price</label>
          <p className="muted">This is what you will pay the worker for this job.</p>
          <div className="segmented-control" role="group" aria-label={getBillingOpsCopy(locale).paymentMethod} style={{ marginTop: 8 }}>
            <button type="button" className={`btn${contractorPayMode === 'flat' ? ' btn-primary' : ''}`} onClick={() => setContractorPayMode('flat')}>Flat rate</button>
            <button type="button" className={`btn${contractorPayMode === 'hourly' ? ' btn-primary' : ''}`} onClick={() => setContractorPayMode('hourly')}>Hourly</button>
          </div>
          {contractorPayMode === 'hourly' ? (
            <>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <div className="form-group">
                  <label>Hours</label>
                  <input className="input" type="number" min="0" step="0.25" value={contractorHours} onChange={(e) => setContractorHours(e.target.value)} />
                  {durationHoursValue(jobDurationHours) ? (
                    <button className="btn" type="button" style={{ marginTop: 8 }} onClick={() => setContractorHours(jobDurationHours)}>
                      Use job duration
                    </button>
                  ) : null}
                </div>
                <div className="form-group"><label>Worker hourly rate</label><input className="input" type="number" min="0" step="0.01" value={contractorHourlyRate} onChange={(e) => setContractorHourlyRate(e.target.value)} /></div>
              </div>
              <p className="muted">Worker cost: ${previewContractorPay.toFixed(2)}</p>
            </>
          ) : (
            <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={contractorFlatRate} onChange={(e) => setContractorFlatRate(e.target.value)} />
          )}
          <label>Job notes</label>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>

        <details style={{ marginTop: 12 }}>
          <summary>More options</summary>

          <section className="job-create-section">
            <label htmlFor="recurrence-frequency">{recurrenceCopy.scheduleType}</label>
            <select
              id="recurrence-frequency"
              className="input"
              value={recurrenceFrequency}
              onChange={(e) => {
                const next = e.target.value as RecurrenceFrequency;
                setRecurrenceFrequency(next);
                if (next !== 'none') {
                  if (visits.length > 1) setVisits((rows) => [rows[0]]);
                  const date = visits[0]?.visit_date || recurrenceStartDate;
                  if (date) setRecurrenceStartDate(date);
                }
                if (next === 'daily') setRecurrenceIntervalUnit('days');
                if (next === 'monthly') setRecurrenceIntervalUnit('months');
                if (next === 'weekly' || next === 'biweekly' || next === 'every_three_weeks' || next === 'every_four_weeks') setRecurrenceIntervalUnit('weeks');
              }}
            >
              <option value="none">{recurrenceCopy.oneTime}</option>
              <option value="daily">{recurrenceCopy.daily}</option>
              <option value="weekly">{recurrenceCopy.weekly}</option>
              <option value="biweekly">{recurrenceCopy.everyTwoWeeks}</option>
              <option value="every_three_weeks">{recurrenceCopy.everyThreeWeeks}</option>
              <option value="every_four_weeks">{recurrenceCopy.everyFourWeeks}</option>
              <option value="monthly">{recurrenceCopy.monthly}</option>
              <option value="custom">{recurrenceCopy.custom}</option>
            </select>

            {isRecurring ? (
              <>
                {showWeekdays ? (
                  <fieldset style={{ marginTop: 12, border: 0, padding: 0 }}>
                    <legend style={{ fontWeight: 600 }}>{recurrenceCopy.weekdays}</legend>
                    <p className="muted">{recurrenceCopy.weekdaysHelp}</p>
                    <div className="segmented-control" role="group" aria-label={recurrenceCopy.weekdays} style={{ flexWrap: 'wrap' }}>
                      {weekdayLabels.map((label, index) => {
                        const selected = recurrenceWeekdays.includes(index);
                        return (
                          <button
                            key={label}
                            type="button"
                            className={`btn${selected ? ' btn-primary' : ''}`}
                            aria-pressed={selected}
                            onClick={() => {
                              setRecurrenceFieldErrors((current) => ({ ...current, weekdays: undefined }));
                              setRecurrenceWeekdays((current) => {
                                if (current.includes(index)) {
                                  const next = current.filter((day) => day !== index);
                                  return next.length ? next : current;
                                }
                                return [...current, index].sort((a, b) => a - b);
                              });
                            }}
                          >
                            {label.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                    {recurrenceFieldErrors.weekdays ? <p className="auth-message auth-message-error" role="alert">{recurrenceFieldErrors.weekdays}</p> : null}
                  </fieldset>
                ) : null}

                <label htmlFor="job-timezone">{recurrenceCopy.jobTimezone}</label>
                <select id="job-timezone" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                  <option value="">{recurrenceCopy.companyDefaultTimezone}</option>
                  {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <p className="muted">{recurrenceCopy.timezoneHelp}</p>

                <label htmlFor="recurrence-end-mode" style={{ marginTop: 12 }}>{recurrenceCopy.ends}</label>
                <select
                  id="recurrence-end-mode"
                  className="input"
                  value={recurrenceEndMode}
                  onChange={(e) => {
                    setRecurrenceEndMode(e.target.value as RecurrenceEndMode);
                    setRecurrenceFieldErrors((current) => ({ ...current, endDate: undefined, limit: undefined }));
                  }}
                >
                  <option value="never">{recurrenceCopy.neverEnds}</option>
                  <option value="on_date">{recurrenceCopy.endsOnDate}</option>
                  <option value="after_count">{recurrenceCopy.endsAfterCount}</option>
                </select>
                {recurrenceEndMode === 'on_date' ? (
                  <>
                    <label htmlFor="recurrence-end-date">{recurrenceCopy.endDate}</label>
                    <input id="recurrence-end-date" className="input" type="date" aria-invalid={Boolean(recurrenceFieldErrors.endDate)} value={recurrenceEndDate} onChange={(e) => {
                      setRecurrenceEndDate(e.target.value);
                      setRecurrenceFieldErrors((current) => ({ ...current, endDate: undefined }));
                    }} />
                    {recurrenceFieldErrors.endDate ? <p className="auth-message auth-message-error" role="alert">{recurrenceFieldErrors.endDate}</p> : null}
                  </>
                ) : null}
                {recurrenceEndMode === 'after_count' ? (
                  <>
                    <label htmlFor="recurrence-limit">{recurrenceCopy.occurrenceCount}</label>
                    <input id="recurrence-limit" className="input" type="number" min="1" aria-invalid={Boolean(recurrenceFieldErrors.limit)} value={recurrenceLimit} onChange={(e) => {
                      setRecurrenceLimit(e.target.value);
                      setRecurrenceFieldErrors((current) => ({ ...current, limit: undefined }));
                    }} />
                    {recurrenceFieldErrors.limit ? <p className="auth-message auth-message-error" role="alert">{recurrenceFieldErrors.limit}</p> : null}
                  </>
                ) : null}

                <details open={showRecurrenceAdvanced || recurrenceFrequency === 'custom'} onToggle={(e) => setShowRecurrenceAdvanced((e.target as HTMLDetailsElement).open)}>
                  <summary>{recurrenceCopy.advanced}</summary>
                  {recurrenceFrequency === 'custom' ? (
                    <div className="grid-2" style={{ marginTop: 8 }}>
                      <div className="form-group"><label>{recurrenceCopy.every}</label><input className="input" type="number" min="1" max="365" value={recurrenceInterval} onChange={(e) => setRecurrenceInterval(e.target.value)} /></div>
                      <div className="form-group"><label>{recurrenceCopy.unit}</label><select className="input" value={recurrenceIntervalUnit} onChange={(e) => setRecurrenceIntervalUnit(e.target.value as RecurrenceIntervalUnit)}><option value="days">{recurrenceCopy.days}</option><option value="weeks">{recurrenceCopy.weeks}</option><option value="months">{recurrenceCopy.months}</option></select></div>
                    </div>
                  ) : null}
                  <p className="muted">{recurrenceCopy.windowHelp}</p>
                </details>
                <p className="muted" style={{ marginTop: 8 }} aria-live="polite"><strong>{recurrenceCopy.summaryLabel}:</strong> {recurrenceSummary}</p>
              </>
            ) : (
              <>
                <p className="muted">Add one or more visits. Times use the job timezone below.</p>
                <label htmlFor="job-timezone">Job timezone</label>
                <select id="job-timezone" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                  <option value="">Use company default</option>
                  {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <p className="muted">Filled from the property address when available. You can change it.</p>
                {primaryVisit ? <><label>Visit notes</label><input className="input" value={primaryVisit.notes} onChange={(e) => updateVisit(primaryVisit.id, { notes: e.target.value })} /></> : null}
                {visits.slice(1).map((visit, index) => (
                  <div key={visit.id} className="form visit-editor">
                    <label>Visit {index + 2}</label>
                    <input className="input" type="date" value={visit.visit_date} onChange={(e) => updateVisit(visit.id, { visit_date: e.target.value })} />
                    <div className="grid-2">
                      <div className="form-group"><label>Start time</label><input className="input" type="time" value={visit.start_time} onChange={(e) => updateVisit(visit.id, { start_time: e.target.value })} /></div>
                      <div className="form-group"><label>End time</label><input className="input" type="time" value={visit.end_time} onChange={(e) => updateVisit(visit.id, { end_time: e.target.value })} /></div>
                    </div>
                    <label>Visit notes</label>
                    <input className="input" value={visit.notes} onChange={(e) => updateVisit(visit.id, { notes: e.target.value })} />
                    <button className="btn" type="button" onClick={() => removeVisit(visit.id)}>Remove visit</button>
                  </div>
                ))}
                <button className="btn" type="button" onClick={() => setVisits((rows) => [...rows, newVisit()])}>Add another visit</button>
              </>
            )}
          </section>

          <section className="job-create-section">
            <label style={{ marginTop: 12 }}>Additional expected expenses</label>
            <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={additionalExpenses} onChange={(e) => setAdditionalExpenses(e.target.value)} />
            <label>Expense description (optional)</label>
            <input className="input" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder="Supplies, parking, travel…" />

            <label style={{ marginTop: 12 }}>Worker pay notes (optional)</label>
            <input className="input" value={contractorNotes} onChange={(e) => setContractorNotes(e.target.value)} />

            <div className="finance-metric-grid financials-summary-grid" style={{ marginTop: 14 }}>
              <div className="finance-metric"><span className="finance-metric-label">Customer price</span><strong>${previewFinance.expectedRevenue.toFixed(2)}</strong></div>
              <div className="finance-metric"><span className="finance-metric-label">Worker price</span><strong>${previewContractorPay.toFixed(2)}</strong></div>
              <div className="finance-metric"><span className="finance-metric-label">Additional expenses</span><strong>${previewFinance.expectedAdditionalExpense.toFixed(2)}</strong></div>
              <div className="finance-metric featured"><span className="finance-metric-label">Expected profit</span><strong>${previewProfit.toFixed(2)}</strong></div>
            </div>
            <p className="muted">Expected profit = Customer price − Worker price − Additional expected expenses</p>
          </section>

          <section className="job-create-section">
            <details style={{ marginTop: 12 }} open={showAdvancedProperty} onToggle={(e) => setShowAdvancedProperty((e.target as HTMLDetailsElement).open)}>
              <summary>{createCopy.accessNotes}</summary>
              <label style={{ marginTop: 10 }}>{createCopy.accessInstructions}</label>
              <textarea className="input" rows={3} value={accessInstructions} onChange={(e) => setAccessInstructions(e.target.value)} />
              <p className="muted">{createCopy.accessPrivacy}</p>
            </details>
          </section>

          <section className="job-create-section">
            <h4>Initial photos</h4>
            <p className="muted">Optional before photos. You can edit or add more photos after the job is created.</p>
            <input className="input" type="file" accept="image/*" multiple onChange={(e) => setInitialPhotos(Array.from(e.target.files || []))} />
            {initialPhotos.length > 0 ? <p className="muted">{initialPhotos.length} photo{initialPhotos.length === 1 ? '' : 's'} selected</p> : null}
          </section>

          <section className="job-create-section">
            <h4>7. Review before saving</h4>
            <p style={{ margin: 0 }}><strong>{recurrenceFrequency === 'none' ? 'One-time job' : 'Recurring series'}</strong></p>
            <p className="muted" style={{ marginTop: 6 }}>{recurrenceSummary}</p>
            {recurrenceFrequency !== 'none' ? <p className="muted">Only the next {RECURRING_GENERATION_WINDOW_DAYS} days of visits are scheduled now. Financial defaults apply to each generated visit.</p> : null}
            <p className="muted" style={{ marginTop: 6 }}>
              Per visit: ${previewFinance.expectedRevenue.toFixed(2)} customer price · ${previewContractorPay.toFixed(2)} worker price · ${previewFinance.expectedAdditionalExpense.toFixed(2)} expenses · ${previewProfit.toFixed(2)} expected profit
            </p>
          </section>
        </details>

        <Button className="btn-primary unified-job-save" type="submit" disabled={loading}>
          {loading ? FEEDBACK.loading : 'Create Job'}
        </Button>
      </form>
    </div>
  );
}
