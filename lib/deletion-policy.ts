export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE';
export const ACCOUNT_DELETION_RECOVERY_DAYS = 30;
export const WORKSPACE_DELETION_RECOVERY_DAYS = 30;

export function deletionScheduledAt(from = new Date(), recoveryDays: number): Date {
  return new Date(from.getTime() + recoveryDays * 24 * 60 * 60 * 1000);
}
