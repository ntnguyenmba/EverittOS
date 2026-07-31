import {
  addressesLikelySame,
  normalizeEmailKey,
  normalizePhoneKey
} from '@/lib/address/normalize';

/** Normalize a person/company name for exact duplicate matching. */
export function normalizeCustomerNameKey(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type CustomerMatchInput = {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type CustomerMatchCandidate = {
  id: string;
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  service_address?: string | null;
  property_address?: string | null;
};

function candidateNameKeys(candidate: CustomerMatchCandidate): string[] {
  return [candidate.company_name, candidate.contact_name]
    .map((value) => normalizeCustomerNameKey(value))
    .filter(Boolean);
}

function candidateAddresses(candidate: CustomerMatchCandidate): string[] {
  return [candidate.service_address, candidate.property_address, candidate.address_line1].filter(
    (value): value is string => Boolean(value && value.trim())
  );
}

function namesMatch(inputNameKey: string, candidate: CustomerMatchCandidate): boolean {
  if (!inputNameKey) return false;
  return candidateNameKeys(candidate).includes(inputNameKey);
}

/**
 * Find an existing customer to reuse instead of creating a duplicate.
 * Priority:
 * 1. exact normalized email when present
 * 2. exact normalized phone when present
 * 3. exact normalized name + matching address when address is available
 * 4. exact normalized name when no other identifying details exist
 */
export function findMatchingCustomer(
  input: CustomerMatchInput,
  candidates: CustomerMatchCandidate[]
): CustomerMatchCandidate | null {
  const emailKey = normalizeEmailKey(input.email);
  const phoneKey = normalizePhoneKey(input.phone);
  const nameKey = normalizeCustomerNameKey(input.displayName);
  const address = input.address?.trim() || '';

  if (emailKey) {
    const byEmail = candidates.find((candidate) => normalizeEmailKey(candidate.email) === emailKey);
    if (byEmail) return byEmail;
  }

  if (phoneKey) {
    const byPhone = candidates.find((candidate) => normalizePhoneKey(candidate.phone) === phoneKey);
    if (byPhone) return byPhone;
  }

  if (nameKey && address) {
    const byNameAndAddress = candidates.find((candidate) => {
      if (!namesMatch(nameKey, candidate)) return false;
      return candidateAddresses(candidate).some((existing) => addressesLikelySame(address, existing));
    });
    if (byNameAndAddress) return byNameAndAddress;
  }

  if (nameKey && !emailKey && !phoneKey && !address) {
    const byNameOnly = candidates.find((candidate) => namesMatch(nameKey, candidate));
    if (byNameOnly) return byNameOnly;
  }

  return null;
}
