/**
 * Customer row helpers — production schema uses `company_name` for the display label.
 * Do not query or write `customers.name` (column may not exist).
 */

export const CUSTOMER_LIST_SELECT =
  'id, company_name, phone, email, address, notes, pipeline_stage, lead_source, record_type, created_at, organization_id, user_id, updated_at, deal_value';

export const CUSTOMER_SEARCH_SELECT = 'id, company_name, email';

export type CustomerRecord = {
  id: string;
  user_id?: string | null;
  organization_id?: string | null;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  pipeline_stage?: string | null;
  lead_source?: string | null;
  record_type?: string | null;
  deal_value?: number | null;
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

export type CustomerWriteInput = {
  displayName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  record_type?: string;
  pipeline_stage?: string;
  lead_source?: string;
};

export function buildCustomerWritePayload(input: CustomerWriteInput): Record<string, unknown> {
  return {
    company_name: input.displayName.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    ...(input.record_type ? { record_type: input.record_type } : {}),
    ...(input.pipeline_stage ? { pipeline_stage: input.pipeline_stage } : {}),
    ...(input.lead_source ? { lead_source: input.lead_source } : {})
  };
}

export function buildCustomerUpdatePayload(input: Partial<CustomerWriteInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.displayName !== undefined) payload.company_name = input.displayName.trim();
  if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
  if (input.email !== undefined) payload.email = input.email?.trim() || null;
  if (input.address !== undefined) payload.address = input.address?.trim() || null;
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
  return payload;
}
