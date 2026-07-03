const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAssignedEmail(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim().toLowerCase();
  return trimmed || null;
}

export function validateAssignedEmail(value: unknown): { ok: true; email: string | null } | { ok: false; error: string } {
  const email = normalizeAssignedEmail(value);
  if (!email) return { ok: true, email: null };
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'Enter a valid email address for Assigned email.' };
  }
  return { ok: true, email };
}
