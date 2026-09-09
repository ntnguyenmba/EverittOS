'use client';

/**
 * Pay is rendered by the contractor jobs page from the API.
 * The old body MutationObserver plus extra Supabase reads ran on every
 * worker navigation and did not change data. Keep this as a no-op.
 */
export function ContractorJobPayVisibility() {
  return null;
}
