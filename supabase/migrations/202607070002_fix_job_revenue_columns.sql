-- Fix job financials schema cache error.
-- Run this in Supabase SQL Editor if production has not received this migration yet.

alter table public.jobs
  add column if not exists revenue_amount numeric(12,2),
  add column if not exists revenue_notes text;

notify pgrst, 'reload schema';
