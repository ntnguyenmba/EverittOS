export type AccountStatus = 'active' | 'disabled';

export function normalizeAccountStatus(value: string | null | undefined): AccountStatus {
  return value === 'disabled' ? 'disabled' : 'active';
}

export function isAccountActive(value: string | null | undefined): boolean {
  return normalizeAccountStatus(value) === 'active';
}

/** True when the profile has been soft-deleted (pending permanent removal). */
export function isAccountDeleted(deletedAt: string | null | undefined): boolean {
  return Boolean(deletedAt);
}
