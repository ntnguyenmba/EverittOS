/**
 * Canonical rule for contractor labor cost:
 * - Use actual job_labor totals when any labor exists.
 * - Otherwise fall back to planned expected_contractor_cost.
 * Never add the two together for the same job.
 */
export function effectiveContractorCost(
  expectedContractorCost: number | null | undefined,
  laborTotal: number | null | undefined
): number {
  const labor = Number(laborTotal || 0);
  if (Number.isFinite(labor) && labor > 0) {
    return Number(labor.toFixed(2));
  }
  const expected = Number(expectedContractorCost || 0);
  if (!Number.isFinite(expected) || expected <= 0) return 0;
  return Number(expected.toFixed(2));
}

export const UNASSIGNED_CONTRACTOR_LABEL = 'Unassigned contractor';
