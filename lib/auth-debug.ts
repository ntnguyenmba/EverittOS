import { appOrigin } from '@/lib/app-url';
import { isProductionRuntime } from '@/lib/safe-api-error';

type AuthDebugMeta = Record<string, string | number | boolean | null | undefined>;

/** Development-only auth diagnostics. Never logs secrets or runs in production. */
export function logAuthDebug(event: string, meta?: AuthDebugMeta): void {
  if (isProductionRuntime()) return;
  if (process.env.NODE_ENV !== 'development' && process.env.AUTH_DEBUG !== '1') return;

  const safe: Record<string, string | number | boolean> = {
    event,
    domain: appOrigin()
  };

  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (value === undefined || value === null) continue;
      const lower = key.toLowerCase();
      if (
        lower.includes('password') ||
        lower.includes('secret') ||
        lower.includes('service_role') ||
        lower.includes('anonkey') ||
        (lower.includes('token') && !lower.includes('host'))
      ) {
        continue;
      }
      safe[key] = typeof value === 'object' ? JSON.stringify(value) : value;
    }
  }

  console.info(`[everittos-auth-debug] ${JSON.stringify(safe)}`);
}
