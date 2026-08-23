-- Faster ledger reads: indexes, rewritten balance math, one-shot dashboard RPC.
-- Safe to re-run. For the matching RLS wraps, re-run supabase/schema.sql
-- (it is idempotent) or skip if you only need the new functions.

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists transactions_account_idx
  on public.transactions (account_id)
  where account_id is not null;
create index if not exists transactions_to_account_idx
  on public.transactions (to_account_id)
  where to_account_id is not null;
create index if not exists transactions_personal_date_idx
  on public.transactions (user_id, occurred_at desc)
  where group_id is null;

-- ── Helpers (auth.uid() wrapped so Postgres can cache it per statement) ─────

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid())
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
    where group_id = gid and user_id = (select auth.uid()) and role = 'owner'
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
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;

-- ── Balances: two indexed scans instead of an OR join ───────────────────────

create or replace function public.account_balances(p_group_id uuid default null)
returns table (account_id uuid, balance bigint)
language sql
stable
set search_path = public
as $$
  with movements as (
    select
      t.account_id as account_id,
      case t.kind
        when 'income' then t.amount - t.fee_amount
        else -t.amount - t.fee_amount
      end as delta
    from public.transactions t
    where t.group_id is not distinct from p_group_id
      and t.account_id is not null

    union all

    select
      t.to_account_id,
      t.amount
    from public.transactions t
    where t.group_id is not distinct from p_group_id
      and t.kind = 'transfer'
      and t.to_account_id is not null
  )
  select
    a.id,
    a.opening_balance + coalesce(sum(m.delta), 0)::bigint
  from public.accounts a
  left join movements m on m.account_id = a.id
  where a.group_id is not distinct from p_group_id
  group by a.id, a.opening_balance;
$$;

create or replace function public.month_history(
  p_group_id uuid default null,
  p_from timestamptz default date_trunc('month', now()) - interval '5 months',
  p_until timestamptz default date_trunc('month', now()) + interval '1 month',
  p_tz text default 'UTC'
)
returns table (month_key text, spent bigint, earned bigint)
language sql
stable
set search_path = public
as $$
  select
    to_char((t.occurred_at at time zone p_tz), 'YYYY-MM') as month_key,
    coalesce(sum(t.fee_amount + case when t.kind = 'expense' then t.amount else 0 end), 0)::bigint as spent,
    coalesce(sum(case when t.kind = 'income' then t.amount else 0 end), 0)::bigint as earned
  from public.transactions t
  where t.group_id is not distinct from p_group_id
    and t.occurred_at >= p_from
    and t.occurred_at < p_until
  group by 1
  order by 1;
$$;

create or replace function public.ledger_home(
  p_group_id uuid default null,
  p_from timestamptz default date_trunc('month', now()),
  p_until timestamptz default date_trunc('month', now()) + interval '1 month',
  p_history_from timestamptz default date_trunc('month', now()) - interval '5 months',
  p_tz text default 'UTC'
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'transactions', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.occurred_at desc), '[]'::jsonb)
      from public.transactions t
      where t.group_id is not distinct from p_group_id
        and t.occurred_at >= p_from
        and t.occurred_at < p_until
    ),
    'history', (
      select coalesce(jsonb_agg(to_jsonb(h) order by h.month_key), '[]'::jsonb)
      from public.month_history(p_group_id, p_history_from, p_until, p_tz) h
    ),
    'accounts', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb)
      from (
        select
          acc.id,
          acc.owner_id,
          acc.group_id,
          acc.name,
          acc.type,
          acc.opening_balance,
          acc.color,
          acc.archived,
          acc.created_at,
          acc.updated_at,
          coalesce(bal.balance, acc.opening_balance) as balance
        from public.accounts acc
        left join public.account_balances(p_group_id) bal on bal.account_id = acc.id
        where acc.group_id is not distinct from p_group_id
          and not acc.archived
      ) a
    ),
    'budgets', (
      select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb)
      from public.budgets b
      where b.group_id is not distinct from p_group_id
    ),
    'members', (
      case
        when p_group_id is null then (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id,
            'name', p.display_name,
            'color', p.color,
            'role', 'owner',
            'is_self', true,
            'avatar_url', p.avatar_url
          )), '[]'::jsonb)
          from public.profiles p
          where p.id = (select auth.uid())
        )
        else (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', gm.user_id,
            'name', coalesce(p.display_name, 'Member'),
            'color', coalesce(p.color, '#6b7280'),
            'role', gm.role,
            'is_self', gm.user_id = (select auth.uid()),
            'avatar_url', p.avatar_url
          ) order by gm.joined_at), '[]'::jsonb)
          from public.group_members gm
          left join public.profiles p on p.id = gm.user_id
          where gm.group_id = p_group_id
        )
      end
    )
  );
$$;

grant execute on function public.month_history(uuid, timestamptz, timestamptz, text)
  to authenticated;
grant execute on function public.ledger_home(uuid, timestamptz, timestamptz, timestamptz, text)
  to authenticated;
grant execute on function public.account_balances(uuid) to authenticated;
