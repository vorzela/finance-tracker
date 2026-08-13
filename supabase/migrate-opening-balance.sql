-- Enforce: opening balance cannot be negative.
-- Running balances (opening + transactions) may still go below zero.

alter table public.accounts
  drop constraint if exists accounts_opening_balance_check;

alter table public.accounts
  add constraint accounts_opening_balance_non_negative
  check (opening_balance >= 0);

-- Clamp any existing bad rows (should be rare).
update public.accounts
set opening_balance = 0
where opening_balance < 0;
