-- Persist locale on customer-facing invoices so later language changes
-- do not rewrite already issued documents.
-- Safe to re-run.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS document_locale text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_document_locale_check'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_document_locale_check
      CHECK (document_locale IS NULL OR document_locale IN ('en', 'es', 'vi'));
  END IF;
END $$;

COMMENT ON COLUMN public.invoices.document_locale IS
  'Locale frozen when the invoice was created or sent for customer-facing rendering.';
