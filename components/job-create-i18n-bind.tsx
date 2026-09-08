'use client';

/**
 * Legacy runtime i18n rewriter for /jobs/new.
 * Intentionally a no-op: MutationObserver + interval DOM rewrites fought
 * React controlled inputs and broke typing on create forms.
 */
export function JobCreateI18nBind() {
  return null;
}
