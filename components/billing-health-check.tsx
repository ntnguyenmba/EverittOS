'use client';

/**
 * Internal billing diagnostics were previously rendered on the customer billing page.
 * Hide the legacy wrapper card so customers do not see an empty box.
 */
export function BillingHealthCheck() {
  return (
    <>
      <style>{`.settings-card:has(.billing-health-check-empty){display:none!important;}`}</style>
      <span className="billing-health-check-empty" aria-hidden="true" />
    </>
  );
}
