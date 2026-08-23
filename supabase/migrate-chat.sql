-- Household chat: messages, push tokens, RLS, realtime, optional Expo push.
-- Safe to re-run. Enable the pg_net extension in Database → Extensions if you
-- want messages to wake a phone that has the app closed.

create table if not exists public.messages (
  id         uuid        primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups (id) on delete cascade,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  body       text        not null
             check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_group_created_idx
  on public.messages (group_id, created_at desc);

create table if not exists public.push_tokens (
  user_id    uuid        primary key references public.profiles (id) on delete cascade,
  token      text        not null,
  platform   text,
  updated_at timestamptz not null default now()
);

alter table public.messages    enable row level security;
alter table public.push_tokens enable row level security;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (public.is_group_member(group_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    user_id = (select auth.uid())
    and public.is_group_member(group_id)
  );

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete using (user_id = (select auth.uid()));

drop policy if exists push_tokens_select on public.push_tokens;
create policy push_tokens_select on public.push_tokens
  for select using (user_id = (select auth.uid()));

drop policy if exists push_tokens_insert on public.push_tokens;
create policy push_tokens_insert on public.push_tokens
  for insert with check (user_id = (select auth.uid()));

drop policy if exists push_tokens_update on public.push_tokens;
create policy push_tokens_update on public.push_tokens
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists push_tokens_delete on public.push_tokens;
create policy push_tokens_delete on public.push_tokens
  for delete using (user_id = (select auth.uid()));

create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  group_name text;
  member_count integer;
  title text;
  rec record;
  payload jsonb;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return new;
  end if;

  select p.display_name into sender_name
  from public.profiles p
  where p.id = new.user_id;

  select g.name into group_name
  from public.groups g
  where g.id = new.group_id;

  select count(*)::integer into member_count
  from public.group_members
  where group_id = new.group_id;

  title := case
    when member_count >= 3 then coalesce(group_name, 'Household') || ' · ' || coalesce(sender_name, 'Someone')
    else coalesce(sender_name, 'Someone')
  end;

  for rec in
    select t.token
    from public.push_tokens t
    join public.group_members gm on gm.user_id = t.user_id
    where gm.group_id = new.group_id
      and t.user_id <> new.user_id
      and length(t.token) > 10
  loop
    payload := jsonb_build_object(
      'to', rec.token,
      'title', title,
      'body', left(new.body, 140),
      'sound', 'default',
      'channelId', 'chat',
      'data', jsonb_build_object('type', 'chat', 'groupId', new.group_id)
    );
    begin
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := payload
      );
    exception when others then
      null;
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_message_notify on public.messages;
create trigger on_message_notify
  after insert on public.messages
  for each row execute function public.notify_chat_message();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.messages;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

grant select, insert, update, delete
  on public.messages, public.push_tokens
  to authenticated;

do $$
begin
  create extension if not exists pg_net;
exception when others then
  null;
end;
$$;
