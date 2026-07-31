import type { StructuredAddress } from '@/lib/address/types';

export const PROPERTY_TYPES = ['home', 'airbnb', 'rental', 'office', 'commercial', 'other'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  home: 'Home',
  airbnb: 'Airbnb',
  rental: 'Rental',
  office: 'Office',
  commercial: 'Commercial',
  other: 'Other'
};

export const CUSTOMER_PROPERTY_SELECT = [
  'id',
  'organization_id',
  'customer_id',
  'user_id',
  'name',
  'property_type',
  'address',
  'address_line_1',
  'address_line_2',
  'city',
  'county',
  'state',
  'state_code',
  'postal_code',
  'country',
  'country_code',
  'formatted_address',
  'latitude',
  'longitude',
  'timezone',
  'access_instructions',
  'gate_code',
  'lockbox_code',
  'parking_instructions',
  'pet_notes',
  'supply_notes',
  'internal_notes',
  'notes',
  'default_price',
  'default_duration_minutes',
  'default_checklist_id',
  'preferred_contractor_id',
  'preferred_team_id',
  'is_primary',
  'is_archived',
  'created_at',
  'updated_at'
].join(', ');

/** Fields safe for search previews and contractor notifications. */
export const CUSTOMER_PROPERTY_PUBLIC_SELECT = [
  'id',
  'organization_id',
  'customer_id',
  'name',
  'property_type',
  'address',
  'address_line_1',
  'address_line_2',
  'city',
  'state',
  'state_code',
  'postal_code',
  'country',
  'formatted_address',
  'latitude',
  'longitude',
  'timezone',
  'default_price',
  'default_duration_minutes',
  'preferred_contractor_id',
  'is_primary',
  'is_archived',
  'created_at',
  'updated_at'
].join(', ');

export type CustomerPropertyRecord = {
  id: string;
  organization_id: string;
  customer_id: string;
  user_id?: string | null;
  name: string;
  property_type?: string | null;
  address?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  state_code?: string | null;
  postal_code?: string | null;
  country?: string | null;
  country_code?: string | null;
  formatted_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  access_instructions?: string | null;
  gate_code?: string | null;
  lockbox_code?: string | null;
  parking_instructions?: string | null;
  pet_notes?: string | null;
  supply_notes?: string | null;
  internal_notes?: string | null;
  notes?: string | null;
  default_price?: number | null;
  default_duration_minutes?: number | null;
  default_checklist_id?: string | null;
  preferred_contractor_id?: string | null;
  preferred_team_id?: string | null;
  is_primary?: boolean | null;
  is_archived?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PropertyWriteInput = {
  name: string;
  property_type?: PropertyType | string | null;
  address?: StructuredAddress | null;
  formatted_address?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
  state_code?: string | null;
  postal_code?: string | null;
  country?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  access_instructions?: string | null;
  gate_code?: string | null;
  lockbox_code?: string | null;
  parking_instructions?: string | null;
  pet_notes?: string | null;
  supply_notes?: string | null;
  internal_notes?: string | null;
  notes?: string | null;
  default_price?: number | null;
  default_duration_minutes?: number | null;
  default_checklist_id?: string | null;
  preferred_contractor_id?: string | null;
  preferred_team_id?: string | null;
  is_primary?: boolean | null;
  is_archived?: boolean | null;
};

export function normalizePropertyType(value: unknown): PropertyType {
  const normalized = String(value || 'home').trim().toLowerCase();
  return (PROPERTY_TYPES as readonly string[]).includes(normalized)
    ? (normalized as PropertyType)
    : 'other';
}

export function propertyDisplayAddress(property: Partial<CustomerPropertyRecord> | null | undefined): string {
  if (!property) return '';
  return (
    property.formatted_address?.trim() ||
    property.address?.trim() ||
    [
      property.address_line_1?.trim(),
      property.address_line_2?.trim(),
      property.city?.trim(),
      property.state_code?.trim() || property.state?.trim(),
      property.postal_code?.trim()
    ]
      .filter(Boolean)
      .join(', ')
  );
}

export function stripSensitivePropertyFields<T extends Partial<CustomerPropertyRecord>>(
  property: T,
  canViewSensitive: boolean
): T {
  if (canViewSensitive) return property;
  return {
    ...property,
    gate_code: null,
    lockbox_code: null,
    access_instructions: property.access_instructions ? '[Access details available to assigned managers]' : null,
    internal_notes: null
  };
}

export function buildPropertyWritePayload(input: PropertyWriteInput): Record<string, unknown> {
  const address = input.address;
  const formatted =
    address?.formattedAddress?.trim() ||
    input.formatted_address?.trim() ||
    input.address_line_1?.trim() ||
    null;

  return {
    name: input.name.trim(),
    property_type: normalizePropertyType(input.property_type),
    address: formatted,
    formatted_address: formatted,
    address_line_1: address?.addressLine1?.trim() || input.address_line_1?.trim() || formatted,
    address_line_2: address?.addressLine2?.trim() || input.address_line_2?.trim() || null,
    city: address?.city?.trim() || input.city?.trim() || null,
    county: address?.county?.trim() || input.county?.trim() || null,
    state: address?.state?.trim() || input.state?.trim() || null,
    state_code: address?.stateCode?.trim() || input.state_code?.trim() || null,
    postal_code: address?.postalCode?.trim() || input.postal_code?.trim() || null,
    country: address?.country?.trim() || input.country?.trim() || null,
    country_code: address?.countryCode?.trim() || input.country_code?.trim() || null,
    latitude: address?.latitude ?? input.latitude ?? null,
    longitude: address?.longitude ?? input.longitude ?? null,
    timezone: input.timezone?.trim() || null,
    access_instructions: input.access_instructions?.trim() || null,
    gate_code: input.gate_code?.trim() || null,
    lockbox_code: input.lockbox_code?.trim() || null,
    parking_instructions: input.parking_instructions?.trim() || null,
    pet_notes: input.pet_notes?.trim() || null,
    supply_notes: input.supply_notes?.trim() || null,
    internal_notes: input.internal_notes?.trim() || null,
    notes: input.notes?.trim() || input.internal_notes?.trim() || null,
    default_price: input.default_price ?? null,
    default_duration_minutes: input.default_duration_minutes ?? null,
    default_checklist_id: input.default_checklist_id || null,
    preferred_contractor_id: input.preferred_contractor_id || null,
    preferred_team_id: input.preferred_team_id || null,
    is_primary: Boolean(input.is_primary),
    is_archived: Boolean(input.is_archived)
  };
}
