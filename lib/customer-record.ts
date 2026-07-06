/**
 * Customer row helpers. Production uses `company_name` for the display label.
 * Keep legacy name fields populated because older production schemas may still
 * require `name` or `full_name` as NOT NULL.
 */

export const CUSTOMER_ADDRESS_FIELDS =
  'address_line1, address_line2, city, state, postal_code, country, service_address, property_address';

export const CUSTOMER_LIST_SELECT =
  `id, company_name, phone, email, notes, logo_path, pipeline_stage, lead_source, record_type, assigned_to, created_at, organization_id, user_id, updated_at, deal_value, ${CUSTOMER_ADDRESS_FIELDS}`;

export const CUSTOMER_SEARCH_SELECT = 'id, company_name, email';

export type CustomerRecord = {
  id: string;
  user_id?: string | null;
  organization_id?: string | null;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  service_address?: string | null;
  property_address?: string | null;
  notes?: string | null;
  pipeline_stage?: string | null;
  lead_source?: string | null;
  record_type?: string | null;
  assigned_to?: string | null;
  deal_value?: number | null;
  logo_path?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function customerDisplayName(
  customer: Partial<CustomerRecord> | null | undefined,
  fallback = 'Unnamed contact'
): string {
  const label = customer?.company_name?.trim();
  if (label) return label;
  const email = customer?.email?.trim();
  if (email) return email;
  const phone = customer?.phone?.trim();
  if (phone) return phone;
  return fallback;
}

export function customerDisplayAddress(
  customer: Partial<CustomerRecord> | null | undefined,
  fallback = ''
): string {
  if (!customer) return fallback;

  const dedicated =
    customer.service_address?.trim() ||
    customer.property_address?.trim() ||
    null;
  if (dedicated) return dedicated;

  const parts = [
    customer.address_line1?.trim(),
    customer.address_line2?.trim(),
    customer.city?.trim(),
    customer.state?.trim(),
    customer.postal_code?.trim(),
    customer.country?.trim()
  ].filter(Boolean);

  if (parts.length) return parts.join(', ');
  return fallback;
}

export function isLeadRecord(customer: Partial<CustomerRecord> | null | undefined): boolean {
  return customer?.record_type === 'lead';
}

export type CustomerWriteInput = {
  displayName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  record_type?: string;
  pipeline_stage?: string;
  lead_source?: string;
  assigned_to?: string | null;
};

export type CustomerUpdateInput = Partial<CustomerWriteInput>;

function addressWriteFields(address?: string | null): Record<string, unknown> {
  const line = address?.trim() || null;
  if (!line) return {};
  return {
    address_line1: line,
    service_address: line
  };
}

export function buildCustomerWritePayload(input: CustomerWriteInput): Record<string, unknown> {
  const label = input.displayName.trim();
  return {
    company_name: label,
    name: label,
    full_name: label,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
    assigned_to: input.assigned_to?.trim() || null,
    ...addressWriteFields(input.address),
    ...(input.record_type ? { record_type: input.record_type } : {}),
    ...(input.pipeline_stage ? { pipeline_stage: input.pipeline_stage } : {}),
    ...(input.lead_source ? { lead_source: input.lead_source } : {})
  };
}

export function buildCustomerUpdatePayload(input: CustomerUpdateInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.displayName !== undefined) {
    const label = input.displayName.trim();
    payload.company_name = label;
    payload.name = label;
    payload.full_name = label;
  }
  if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
  if (input.email !== undefined) payload.email = input.email?.trim() || null;
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
  if (input.assigned_to !== undefined) payload.assigned_to = input.assigned_to?.trim() || null;
  if (input.address !== undefined) {
    Object.assign(payload, addressWriteFields(input.address));
  }
  if (input.pipeline_stage !== undefined) payload.pipeline_stage = input.pipeline_stage;
  if (input.lead_source !== undefined) payload.lead_source = input.lead_source;
  if (input.record_type !== undefined) payload.record_type = input.record_type;
  return payload;
}
