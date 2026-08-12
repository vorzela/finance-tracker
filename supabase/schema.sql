-- ============================================================================
-- Duo Wallet — Supabase schema
--
-- Paste this whole file into the Supabase dashboard SQL editor and run it once.
-- It is safe to re-run: every object is created with `if not exists`, and
-- policies are dropped before being recreated.
--
-- Two scopes exist throughout, and the difference is always `group_id`:
--   • personal  → group_id is null, readable only by the row's owner
--   • shared    → group_id set,     readable by every member of that group
--
-- Money is stored as bigint minor units (cents) so sums never drift.
-- Categories live in the app (lib/categories.ts), so `category_id` is text.
--
-- Two rules worth knowing before reading on:
--   • A transaction fee (M-Pesa charge, bank charge) is spending. It rides on
--     the transaction that caused it as `fee_amount`, and every total that
--     counts spending counts it too.
--   • Time is kept, not just the date. `occurred_at` is a timestamptz so the
--     ledger can answer "when did this happen", which is the point of sharing
--     one with someone else.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Profiles ────────────────────────────────────────────────────────────────
-- One row per auth user, created automatically by the trigger further down.

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text        not null default 'Me',
  color         text        not null default '#2a5298',
  currency_code text        not null default 'KES',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Groups ──────────────────────────────────────────────────────────────────
-- A household. Joining happens through the `join_group` function below, using
-- a short human-readable invite code rather than the UUID.

create table if not exists public.groups (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  currency_code text        not null default 'KES',
  invite_code   text        not null unique,
  created_by    uuid        not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid        not null references public.groups (id) on delete cascade,
  user_id   uuid        not null references public.profiles (id) on delete cascade,
  role      text        not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);

-- ── Accounts ────────────────────────────────────────────────────────────────
-- Where money sits. Balances are always derived from transactions, never stored.

create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid        not null references public.profiles (id) on delete cascade,
  group_id        uuid        references public.groups (id)         on delete cascade,
  name            text        not null,
  type            text        not null default 'cash'
                  check (type in ('cash', 'bank', 'mobile', 'card')),
  opening_balance bigint      not null default 0,
  color           text        not null default '#2a5298',
  archived        boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists accounts_scope_idx on public.accounts (group_id, owner_id);

-- ── Debts ───────────────────────────────────────────────────────────────────
-- What you owe, and what is owed to you. The balance is never stored: it is
-- the principal minus every transaction that points at the debt, so paying one
-- off is just ordinary spending that happens to be tagged.

create table if not exists public.debts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  group_id     uuid        references public.groups (id)       on delete cascade,
  name         text        not null,
  direction    text        not null default 'owed_by_me'
               check (direction in ('owed_by_me', 'owed_to_me')),
  counterparty text,
  principal    bigint      not null check (principal > 0),
  due_on       date,
  note         text,
  closed       boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists debts_scope_idx on public.debts (group_id, user_id);

-- ── Transactions ────────────────────────────────────────────────────────────
-- `user_id` is who the spend belongs to, which is what drives the per-person
-- split on the shared dashboard.
--
-- `fee_amount` is the transaction cost: the M-Pesa or bank charge that came
-- with the movement. It always leaves `account_id`, whatever the kind, because
-- that is where the charge is levied.

create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references public.profiles (id)  on delete cascade,
  group_id      uuid        references public.groups (id)           on delete cascade,
  kind          text        not null check (kind in ('expense', 'income', 'transfer')),
  amount        bigint      not null check (amount > 0),
  fee_amount    bigint      not null default 0 check (fee_amount >= 0),
  category_id   text        not null default 'other',
  account_id    uuid        references public.accounts (id)         on delete set null,
  to_account_id uuid        references public.accounts (id)         on delete set null,
  debt_id       uuid        references public.debts (id)            on delete set null,
  note          text,
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint transfer_has_destination
    check (kind <> 'transfer' or to_account_id is not null),
  -- Without this, a transfer onto itself would be counted twice by the
  -- balance function below.
  constraint transfer_moves_somewhere_else
    check (to_account_id is null or to_account_id <> account_id)
);

create index if not exists transactions_group_date_idx
  on public.transactions (group_id, occurred_at desc);
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_at desc);
create index if not exists transactions_debt_idx
  on public.transactions (debt_id) where debt_id is not null;

-- ── Recurring entries ───────────────────────────────────────────────────────
-- A monthly salary or a fixed bill, described once. `post_due_recurring()`
-- turns them into real transactions when their day of the month arrives, and
-- `last_posted_month` is what keeps that from happening twice.

create table if not exists public.recurring_entries (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.profiles (id) on delete cascade,
  group_id          uuid        references public.groups (id)       on delete cascade,
  kind              text        not null check (kind in ('income', 'expense')),
  label             text        not null,
  amount            bigint      not null check (amount > 0),
  category_id       text        not null default 'salary',
  account_id        uuid        references public.accounts (id)     on delete set null,
  day_of_month      integer     not null default 1
                    check (day_of_month between 1 and 31),
  active            boolean     not null default true,
  last_posted_month text        check (last_posted_month is null
                                       or last_posted_month ~ '^\d{4}-\d{2}$'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists recurring_scope_idx
  on public.recurring_entries (group_id, user_id);

-- ── Budgets ─────────────────────────────────────────────────────────────────
-- A monthly ceiling. `category_id` null means the ceiling covers all spending.
-- `month` null means the budget repeats every month.

create table if not exists public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  group_id     uuid        references public.groups (id)       on delete cascade,
  category_id  text,
  limit_amount bigint      not null check (limit_amount > 0),
  month        text        check (month is null or month ~ '^\d{4}-\d{2}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One budget per category per scope per month.
create unique index if not exists budgets_scope_unique
  on public.budgets (
    coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid),
    case when group_id is null then user_id else '00000000-0000-0000-0000-000000000000'::uuid end,
    coalesce(category_id, '*'),
    coalesce(month, '*')
  );

-- ============================================================================
-- Helpers
--
-- These are `security definer` on purpose: a policy on `group_members` that
-- queried `group_members` directly would recurse forever.
-- ============================================================================

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.shares_group_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;

-- Touches `updated_at` on every write.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Gives every new auth user a profile, seeded with the name typed at sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, currency_code)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'currency_code'), ''), 'KES')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'groups', 'accounts', 'transactions',
                           'budgets', 'debts', 'recurring_entries']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;

-- ============================================================================
-- Group creation / joining
--
-- Both run as `security definer` because a user cannot see a group, or insert
-- their own membership, until they are already a member of it.
-- ============================================================================

-- Six characters from an alphabet with no 0/O or 1/I to avoid misreadings.
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text;
begin
  loop
    code := '';
    for i in 1 .. 6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_group(p_name text, p_currency text default 'KES')
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group public.groups;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Group name is required';
  end if;

  insert into public.groups (name, currency_code, invite_code, created_by)
  values (trim(p_name), coalesce(nullif(trim(p_currency), ''), 'KES'),
          public.generate_invite_code(), auth.uid())
  returning * into new_group;

  insert into public.group_members (group_id, user_id, role)
  values (new_group.id, auth.uid(), 'owner');

  return new_group;
end;
$$;

create or replace function public.join_group(p_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.groups;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into target
  from public.groups
  where invite_code = upper(trim(p_code));

  if target.id is null then
    raise exception 'That invite code does not match any group';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return target;
end;
$$;

-- Invalidates the old code, for when an invite has been shared too widely.
create or replace function public.rotate_invite_code(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  fresh text;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Only the group owner can rotate the invite code';
  end if;

  fresh := public.generate_invite_code();
  update public.groups set invite_code = fresh where id = p_group_id;
  return fresh;
end;
$$;

-- ============================================================================
-- Derived balances
--
-- `security invoker` (the default) is deliberate here: the caller's row level
-- security policies still apply, so this can only ever sum rows they may read.
-- ============================================================================

create or replace function public.account_balances(p_group_id uuid default null)
returns table (account_id uuid, balance bigint)
language sql
stable
set search_path = public
as $$
  select
    a.id,
    a.opening_balance + coalesce(sum(
      case
        when t.id is null                                   then 0
        -- The fee is deducted wherever the money moved from, so it is
        -- subtracted on every kind rather than only on expenses.
        when t.account_id = a.id    and t.kind = 'income'   then  t.amount - t.fee_amount
        when t.account_id = a.id    and t.kind = 'expense'  then -t.amount - t.fee_amount
        when t.account_id = a.id    and t.kind = 'transfer' then -t.amount - t.fee_amount
        when t.to_account_id = a.id and t.kind = 'transfer' then  t.amount
        else 0
      end
    ), 0)
  from public.accounts a
  left join public.transactions t
    on t.account_id = a.id or t.to_account_id = a.id
  where a.group_id is not distinct from p_group_id
  group by a.id, a.opening_balance;
$$;

-- What each person in the ledger is holding. On a couple's shared ledger the
-- app sums these into one household figure, and shows the split underneath.
create or replace function public.member_balances(p_group_id uuid default null)
returns table (user_id uuid, opening_balance bigint, balance bigint)
language sql
stable
set search_path = public
as $$
  select
    a.owner_id,
    coalesce(sum(a.opening_balance), 0)::bigint,
    coalesce(sum(b.balance), 0)::bigint
  from public.accounts a
  join public.account_balances(p_group_id) b on b.account_id = a.id
  where a.group_id is not distinct from p_group_id
    and not a.archived
  group by a.owner_id;
$$;

-- How much of each debt is left. Payments are transactions tagged with the
-- debt, so this needs no separate payments table.
create or replace function public.debt_balances(p_group_id uuid default null)
returns table (debt_id uuid, paid bigint, balance bigint)
language sql
stable
set search_path = public
as $$
  select
    d.id,
    coalesce(sum(t.amount), 0)::bigint,
    greatest(d.principal - coalesce(sum(t.amount), 0), 0)::bigint
  from public.debts d
  left join public.transactions t on t.debt_id = d.id
  where d.group_id is not distinct from p_group_id
  group by d.id, d.principal;
$$;

-- ============================================================================
-- Recurring entries → transactions
--
-- Called on app open. `security invoker` is deliberate: the caller's policies
-- apply, and the `user_id = auth.uid()` filter means one phone can never post
-- the other person's salary.
-- ============================================================================

create or replace function public.post_due_recurring()
returns integer
language plpgsql
set search_path = public
as $$
declare
  entry      public.recurring_entries;
  this_month text := to_char(now(), 'YYYY-MM');
  last_day   integer := extract(day from (date_trunc('month', now()) + interval '1 month - 1 day'))::int;
  today      integer := extract(day from now())::int;
  post_day   integer;
  posted     integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  for entry in
    select *
    from public.recurring_entries
    where user_id = auth.uid()
      and active
      and coalesce(last_posted_month, '') <> this_month
  loop
    -- A "31st" entry still has to land in February.
    post_day := least(entry.day_of_month, last_day);
    continue when post_day > today;

    insert into public.transactions
      (user_id, group_id, kind, amount, category_id, account_id, note, occurred_at)
    values
      (entry.user_id, entry.group_id, entry.kind, entry.amount, entry.category_id,
       entry.account_id, entry.label,
       date_trunc('month', now()) + make_interval(days => post_day - 1, hours => 9));

    update public.recurring_entries
       set last_posted_month = this_month
     where id = entry.id;

    posted := posted + 1;
  end loop;

  return posted;
end;
$$;

-- ============================================================================
-- Row level security
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.groups            enable row level security;
alter table public.group_members     enable row level security;
alter table public.accounts          enable row level security;
alter table public.transactions      enable row level security;
alter table public.budgets           enable row level security;
alter table public.debts             enable row level security;
alter table public.recurring_entries enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
-- Readable for yourself and for anyone you share a group with, so the app can
-- label rows with a person's name.

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.shares_group_with(id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── groups ──────────────────────────────────────────────────────────────────
-- Inserts go through `create_group`, so there is deliberately no insert policy.

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select using (public.is_group_member(id));

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups
  for update using (public.is_group_owner(id)) with check (public.is_group_owner(id));

drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups
  for delete using (public.is_group_owner(id));

-- ── group_members ───────────────────────────────────────────────────────────
-- Inserts go through `join_group`. Members may leave; owners may remove others.

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select using (user_id = auth.uid() or public.is_group_member(group_id));

drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members
  for delete using (user_id = auth.uid() or public.is_group_owner(group_id));

-- ── accounts ────────────────────────────────────────────────────────────────
-- Shared accounts are editable by any member: a household ledger is only
-- useful if either partner can fix it.

drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts
  for select using (
    case when group_id is null
      then owner_id = auth.uid()
      else public.is_group_member(group_id)
    end
  );

drop policy if exists accounts_insert on public.accounts;
create policy accounts_insert on public.accounts
  for insert with check (
    owner_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );

drop policy if exists accounts_update on public.accounts;
create policy accounts_update on public.accounts
  for update using (
    case when group_id is null
      then owner_id = auth.uid()
      else public.is_group_member(group_id)
    end
  ) with check (
    group_id is null or public.is_group_member(group_id)
  );

drop policy if exists accounts_delete on public.accounts;
create policy accounts_delete on public.accounts
  for delete using (
    case when group_id is null
      then owner_id = auth.uid()
      else public.is_group_member(group_id)
    end
  );

-- ── transactions ────────────────────────────────────────────────────────────

drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select using (
    case when group_id is null
      then user_id = auth.uid()
      else public.is_group_member(group_id)
    end
  );

drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert with check (
    user_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );

drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update using (
    case when group_id is null
      then user_id = auth.uid()
      else public.is_group_member(group_id)
    end
  ) with check (
    group_id is null or public.is_group_member(group_id)
  );

drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
  for delete using (
    case when group_id is null
      then user_id = auth.uid()
      else public.is_group_member(group_id)
    end
  );

-- ── budgets ─────────────────────────────────────────────────────────────────

drop policy if exists budgets_select on public.budgets;
create policy budgets_select on public.budgets
  for select using (
    case when group_id is null
      then user_id = auth.uid()
      else public.is_group_member(group_id)
    end
  );

drop policy if exists budgets_insert on public.budgets;
create policy budgets_insert on public.budgets
  for insert with check (
    user_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );

drop policy if exists budgets_update on public.budgets;
create policy budgets_update on public.budgets
  for update using (
    case when group_id is null
      then user_id = auth.uid()
      else public.is_group_member(group_id)
    end
  ) with check (
    group_id is null or public.is_group_member(group_id)
  );

drop policy if exists budgets_delete on public.budgets;
create policy budgets_delete on public.budgets
  for delete using (
    case when group_id is null
      then user_id = auth.uid()
      else public.is_group_member(group_id)
    end
  );

-- ── debts ───────────────────────────────────────────────────────────────────
-- A debt on a shared ledger is the household's problem, so either partner can
-- see and edit it.

drop policy if exists debts_select on public.debts;
create policy debts_select on public.debts
  for select using (
    case when group_id is null
      then user_id = auth.uid()
      else public.is_group_member(group_id)
    end
  );

drop policy if exists debts_insert on public.debts;
create policy debts_insert on public.debts
  for insert with check (
    user_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );

drop policy if exists debts_update on public.debts;
create policy debts_update on public.debts
  for update using (
    case when group_id is null
      then user_id = auth.uid()
      else public.is_group_member(group_id)
    end
  ) with check (
    group_id is null or public.is_group_member(group_id)
  );

drop policy if exists debts_delete on public.debts;
create policy debts_delete on public.debts
  for delete using (
    case when group_id is null
      then user_id = auth.uid()
      else public.is_group_member(group_id)
    end
  );

-- ── recurring_entries ───────────────────────────────────────────────────────
-- Visible to the household, but only the owner may change one: a salary is
-- posted as its owner, so letting anyone edit it would post money as someone
-- else.

drop policy if exists recurring_select on public.recurring_entries;
create policy recurring_select on public.recurring_entries
  for select using (
    case when group_id is null
      then user_id = auth.uid()
      else public.is_group_member(group_id)
    end
  );

drop policy if exists recurring_insert on public.recurring_entries;
create policy recurring_insert on public.recurring_entries
  for insert with check (
    user_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );

drop policy if exists recurring_update on public.recurring_entries;
create policy recurring_update on public.recurring_entries
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );

drop policy if exists recurring_delete on public.recurring_entries;
create policy recurring_delete on public.recurring_entries
  for delete using (user_id = auth.uid());

-- ============================================================================
-- Realtime — lets one phone see the other's entry appear without a refresh.
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.transactions;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.budgets;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.accounts;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.debts;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

-- ============================================================================
-- Grants — RLS still applies; these only expose the objects to the API roles.
-- ============================================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on public.profiles, public.groups, public.group_members,
     public.accounts, public.transactions, public.budgets,
     public.debts, public.recurring_entries
  to authenticated;
grant execute on function public.create_group(text, text)   to authenticated;
grant execute on function public.join_group(text)           to authenticated;
grant execute on function public.rotate_invite_code(uuid)   to authenticated;
grant execute on function public.account_balances(uuid)     to authenticated;
grant execute on function public.member_balances(uuid)      to authenticated;
grant execute on function public.debt_balances(uuid)        to authenticated;
grant execute on function public.post_due_recurring()       to authenticated;
