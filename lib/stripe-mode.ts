export type StripeKeyMode = 'live' | 'test' | 'unknown';

export function stripeKeyMode(secretKey: string | null | undefined): StripeKeyMode {
  const key = (secretKey || '').trim();
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

export function stripeKeyModeLabel(mode: StripeKeyMode): string {
  if (mode === 'live') return 'live';
  if (mode === 'test') return 'test';
  return 'unknown';
}
