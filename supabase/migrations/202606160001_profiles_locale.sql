-- Per-user UI language preference (en, es, vi). Defaults to English.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale text DEFAULT 'en';

COMMENT ON COLUMN profiles.locale IS 'User preferred UI language: en, es, or vi';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_locale_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_locale_check CHECK (locale IN ('en', 'es', 'vi'));
  END IF;
END $$;
