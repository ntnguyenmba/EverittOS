export type AccountStatus = 'active' | 'disabled';

export function normalizeAccountStatus(value: string | null | undefined): AccountStatus {
  return value === 'disabled' ? 'disabled' : 'active';
}

export function isAccountActive(value: string | null | undefined): boolean {
  return normalizeAccountStatus(value) === 'active';
}
