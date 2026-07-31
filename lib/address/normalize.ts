/** Normalize an address for duplicate detection. Keeps unit/apartment detail. */
export function normalizeAddressKey(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[#]/g, ' ')
    .replace(/\b(apartment|apt|suite|ste|unit|fl|floor|#)\b\.?/g, ' $1 ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function addressesLikelySame(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeAddressKey(a);
  const right = normalizeAddressKey(b);
  if (!left || !right) return false;
  return left === right;
}

export function normalizePhoneKey(value: string | null | undefined): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

export function normalizeEmailKey(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}
