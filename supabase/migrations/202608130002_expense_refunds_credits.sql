-- Allow negative expense amounts for refunds and credits.
-- Zero remains invalid because it has no financial effect.

alter table public.expenses
  drop constraint if exists expenses_amount_check;

alter table public.expenses
  add constraint expenses_amount_check check (amount <> 0);
