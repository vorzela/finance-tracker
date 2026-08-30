-- ============================================================================
-- Duo Wallet — reset script
--
-- ⚠️  DESTRUCTIVE. This deletes every Duo Wallet table, function, trigger,
-- policy, and the avatars storage bucket — including all rows in them.
-- It does NOT delete your Supabase auth users (auth.users), only the app
-- data built on top of them.
--
-- Use this when you want to re-run supabase/schema.sql on a totally clean
-- slate (e.g. you've been iterating and want to drop test data, or a
-- previous run left the schema in a state you don't trust). If you're
-- setting up a brand-new Supabase project, you don't need this file at
-- all — schema.sql is already safe to run directly on an empty database.
--
-- Run this first, then paste in the full contents of schema.sql.
-- ============================================================================

-- ── Auth trigger (lives on auth.users, so it isn't dropped by table cascade) ─
drop trigger if exists on_auth_user_created on auth.users;

-- ── Tables (children first; cascade also removes their policies/indexes) ────
drop table if exists public.budgets           cascade;
drop table if exists public.push_tokens       cascade;
drop table if exists public.messages          cascade;
drop table if exists public.recurring_entries cascade;
drop table if exists public.transactions      cascade;
drop table if exists public.debts             cascade;
drop table if exists public.accounts          cascade;
drop table if exists public.group_members     cascade;
drop table if exists public.groups            cascade;
drop table if exists public.profiles          cascade;

-- ── Functions ─────────────────────────────────────────────────────────────
drop function if exists public.is_group_member       cascade;
drop function if exists public.is_group_owner         cascade;
drop function if exists public.shares_group_with      cascade;
drop function if exists public.touch_updated_at        cascade;
drop function if exists public.handle_new_user         cascade;
drop function if exists public.generate_invite_code    cascade;
drop function if exists public.create_group             cascade;
drop function if exists public.join_group                cascade;
drop function if exists public.rotate_invite_code        cascade;
drop function if exists public.account_balances          cascade;
drop function if exists public.member_balances            cascade;
drop function if exists public.debt_balances               cascade;
drop function if exists public.month_history                cascade;
drop function if exists public.ledger_home                   cascade;
drop function if exists public.post_due_recurring             cascade;
drop function if exists public.notify_chat_message              cascade;

-- ── Avatars storage bucket + its policies ────────────────────────────────
drop policy if exists avatars_public_read  on storage.objects;
drop policy if exists avatars_owner_write  on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;
drop policy if exists avatars_owner_delete on storage.objects;
delete from storage.objects where bucket_id = 'avatars';
delete from storage.buckets where id = 'avatars';

-- Done. Now run supabase/schema.sql in full to rebuild everything fresh.
