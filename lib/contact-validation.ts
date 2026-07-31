export function isValidEmail(value: string | null | undefined): boolean {
  const email = String(value || '').trim();
  if (!email) return true; // blank allowed
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(value: string | null | undefined): boolean {
  const phone = String(value || '').trim();
  if (!phone) return true; // blank allowed
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function validateOptionalContact(input: {
  email?: string | null;
  phone?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (!isValidEmail(input.email)) {
    return { ok: false, error: 'Enter a valid email address or leave it blank.' };
  }
  if (!isValidPhone(input.phone)) {
    return { ok: false, error: 'Enter a valid phone number or leave it blank.' };
  }
  return { ok: true };
}

export const PREFERRED_CONTACT_METHODS = ['email', 'phone', 'text', 'any'] as const;
export type PreferredContactMethod = (typeof PREFERRED_CONTACT_METHODS)[number];

export function normalizePreferredContactMethod(value: unknown): PreferredContactMethod | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  return (PREFERRED_CONTACT_METHODS as readonly string[]).includes(normalized)
    ? (normalized as PreferredContactMethod)
    : null;
}
