/** Normalize Stripe-related env values copied from dashboards or Vercel. */
export function sanitizeBillingEnvValue(value: string | undefined | null): string {
  let normalized = (value || '').trim();
  if (!normalized) return '';

  // Strip one layer of surrounding quotes often pasted into env UIs.
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  // Remove accidental trailing newlines from multiline paste.
  return normalized.replace(/[\r\n]+/g, '');
}

export function maskStripeId(id: string | null | undefined): string | null {
  const value = (id || '').trim();
  if (!value) return null;
  if (value.length <= 12) return value;
  return `${value.slice(0, 10)}…${value.slice(-4)}`;
}
