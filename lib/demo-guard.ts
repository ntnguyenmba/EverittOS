import { isProductionRuntime } from '@/lib/safe-api-error';

/** Demo workspaces and seed APIs are disabled in production. */
export function isDemoFeatureEnabled(): boolean {
  if (isProductionRuntime()) return false;
  return process.env.ENABLE_DEMO_FEATURES === '1';
}
