-- Treat blank customer pipeline_stage as active for legacy records.
-- Does not change past, inactive, archived, cancelled, or lead-like stages.

UPDATE public.customers
SET pipeline_stage = 'active'
WHERE lower(coalesce(record_type, 'customer')) = 'customer'
  AND (
    pipeline_stage IS NULL
    OR btrim(pipeline_stage) = ''
  );

COMMENT ON COLUMN public.customers.pipeline_stage IS
  'Customer lifecycle stage. Blank values are migrated to active for customer records.';
