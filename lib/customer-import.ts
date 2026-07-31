import { addressesLikelySame, normalizeEmailKey, normalizePhoneKey } from '@/lib/address/normalize';
import { normalizePropertyType, PROPERTY_TYPES, type PropertyType } from '@/lib/customer-property';

export const CUSTOMER_IMPORT_TEMPLATE_HEADERS = [
  'customer_name',
  'company',
  'email',
  'phone',
  'property_name',
  'property_type',
  'address',
  'city',
  'state',
  'zip',
  'country',
  'notes'
] as const;

export type CustomerImportRow = {
  rowNumber: number;
  customerName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  propertyName: string | null;
  propertyType: PropertyType;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  notes: string | null;
  errors: string[];
  duplicateOfCustomerId?: string | null;
  duplicateReason?: string | null;
};

export type DuplicateDecision = 'skip' | 'merge' | 'create';

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseCsvText(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  return lines.map(splitCsvLine);
}

function headerIndex(headers: string[], ...aliases: string[]): number {
  const lowered = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  for (const alias of aliases) {
    const idx = lowered.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

function cell(row: string[], index: number): string | null {
  if (index < 0) return null;
  const value = (row[index] || '').trim();
  return value || null;
}

export function parseCustomerImportCsv(text: string): { rows: CustomerImportRow[]; headers: string[]; fatalError?: string } {
  const table = parseCsvText(text);
  if (table.length < 2) {
    return { rows: [], headers: [], fatalError: 'CSV must include a header row and at least one data row.' };
  }
  if (table.length > 1001) {
    return { rows: [], headers: table[0], fatalError: 'CSV is limited to 1000 data rows per import.' };
  }

  const headers = table[0];
  const nameIdx = headerIndex(headers, 'customer_name', 'name', 'full_name');
  const companyIdx = headerIndex(headers, 'company', 'company_name');
  const emailIdx = headerIndex(headers, 'email', 'email_address');
  const phoneIdx = headerIndex(headers, 'phone', 'phone_number', 'mobile');
  const propertyNameIdx = headerIndex(headers, 'property_name', 'location_name');
  const propertyTypeIdx = headerIndex(headers, 'property_type', 'type');
  const addressIdx = headerIndex(headers, 'address', 'street', 'address_line_1', 'address1');
  const cityIdx = headerIndex(headers, 'city');
  const stateIdx = headerIndex(headers, 'state', 'province');
  const zipIdx = headerIndex(headers, 'zip', 'postal_code', 'postcode', 'zip_code');
  const countryIdx = headerIndex(headers, 'country');
  const notesIdx = headerIndex(headers, 'notes', 'internal_notes');

  if (nameIdx < 0 && companyIdx < 0) {
    return {
      rows: [],
      headers,
      fatalError: 'CSV must include a customer_name or company column.'
    };
  }

  const rows: CustomerImportRow[] = [];
  for (let i = 1; i < table.length; i += 1) {
    const raw = table[i];
    const customerName = cell(raw, nameIdx) || cell(raw, companyIdx) || '';
    const company = cell(raw, companyIdx);
    const email = cell(raw, emailIdx);
    const phone = cell(raw, phoneIdx);
    const propertyName = cell(raw, propertyNameIdx);
    const address = cell(raw, addressIdx);
    const city = cell(raw, cityIdx);
    const state = cell(raw, stateIdx);
    const zip = cell(raw, zipIdx);
    const country = cell(raw, countryIdx);
    const notes = cell(raw, notesIdx);
    const propertyTypeRaw = cell(raw, propertyTypeIdx);
    const propertyType = propertyTypeRaw ? normalizePropertyType(propertyTypeRaw) : 'home';
    const errors: string[] = [];

    if (!customerName) errors.push('Customer name is required.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email looks invalid.');
    if (propertyTypeRaw && !(PROPERTY_TYPES as readonly string[]).includes(propertyTypeRaw.toLowerCase())) {
      // normalizePropertyType maps unknown to other; warn only for clarity
      if (propertyType === 'other' && propertyTypeRaw.toLowerCase() !== 'other') {
        errors.push(`Unknown property type "${propertyTypeRaw}" will be saved as Other.`);
      }
    }

    rows.push({
      rowNumber: i + 1,
      customerName,
      company,
      email,
      phone,
      propertyName: propertyName || (address ? 'Imported property' : null),
      propertyType,
      address,
      city,
      state,
      zip,
      country,
      notes,
      errors: errors.filter((e) => !e.includes('will be saved as Other'))
    });

    // Soft warning kept separately for preview UX
    if (propertyTypeRaw && propertyType === 'other' && propertyTypeRaw.toLowerCase() !== 'other') {
      rows[rows.length - 1].errors.push(`Unknown property type "${propertyTypeRaw}" will be saved as Other.`);
    }
  }

  return { rows, headers };
}

export type ExistingCustomerForDedupe = {
  id: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  service_address?: string | null;
  property_address?: string | null;
};

export function detectImportDuplicates(
  rows: CustomerImportRow[],
  existing: ExistingCustomerForDedupe[]
): CustomerImportRow[] {
  return rows.map((row) => {
    const emailKey = normalizeEmailKey(row.email);
    const phoneKey = normalizePhoneKey(row.phone);
    const addressKey = [row.address, row.city, row.state, row.zip].filter(Boolean).join(', ');

    const match = existing.find((customer) => {
      if (emailKey && normalizeEmailKey(customer.email) === emailKey) return true;
      if (phoneKey && normalizePhoneKey(customer.phone) === phoneKey) return true;
      const existingAddress =
        customer.service_address || customer.property_address || customer.address_line1 || '';
      if (addressKey && addressesLikelySame(addressKey, existingAddress)) return true;
      return false;
    });

    if (!match) return row;

    let reason = 'Likely duplicate';
    if (emailKey && normalizeEmailKey(match.email) === emailKey) reason = 'Matching email';
    else if (phoneKey && normalizePhoneKey(match.phone) === phoneKey) reason = 'Matching phone';
    else reason = 'Matching address';

    return {
      ...row,
      duplicateOfCustomerId: match.id,
      duplicateReason: reason
    };
  });
}

export function buildCustomerImportTemplateCsv(): string {
  return `${CUSTOMER_IMPORT_TEMPLATE_HEADERS.join(',')}\n` +
    'Jane Doe,Doe Cleaning,jane@example.com,555-0100,Main Home,home,123 Main St,Austin,TX,78701,US,Gate on left\n';
}

export function formattedAddressFromImportRow(row: Pick<CustomerImportRow, 'address' | 'city' | 'state' | 'zip' | 'country'>): string | null {
  const parts = [row.address, row.city, [row.state, row.zip].filter(Boolean).join(' ').trim() || null, row.country]
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
