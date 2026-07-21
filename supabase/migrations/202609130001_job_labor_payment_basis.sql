-- Add first-class contractor payment basis (hourly / flat / visit).
-- Safe to re-run. Preserves existing hours/hourly_cost/total_cost values.

ALTER TABLE public.job_labor
  ADD COLUMN IF NOT EXISTS payment_basis text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_labor_payment_basis_check'
  ) THEN
    ALTER TABLE public.job_labor
      ADD CONSTRAINT job_labor_payment_basis_check
      CHECK (payment_basis IS NULL OR payment_basis IN ('hourly', 'flat', 'visit'));
  END IF;
END $$;

-- Backfill: previous UI treated quantity = 1 as a flat amount.
UPDATE public.job_labor
SET payment_basis = CASE
  WHEN COALESCE(hours, 0) = 1 THEN 'flat'
  ELSE 'hourly'
END
WHERE payment_basis IS NULL;

COMMENT ON COLUMN public.job_labor.payment_basis IS
  'Contractor pay basis: hourly, flat, or visit. quantity uses hours column; rate uses hourly_cost.';
