-- Banat Connect — Supabase schema (run once in Supabase SQL Editor)
--
-- This app syncs its whole state as ONE JSON document in this table
-- (row id = 'main'). Last write wins. Right for a small institute app.
-- The app only ever uses the ANON key — never paste the service_role key
-- into the app or Vercel. For a production setup with real logins, replace
-- the permissive policy below with per-user auth policies.

create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Demo / institute use: anyone with the anon key can read and write the
-- single shared row. The app has no per-user accounts yet (email login is
-- a display identity, not Supabase Auth). Tighten this when real accounts
-- are added.
drop policy if exists "banat app state read" on public.app_state;
create policy "banat app state read" on public.app_state
  for select using (true);

drop policy if exists "banat app state write" on public.app_state;
create policy "banat app state write" on public.app_state
  for all using (true) with check (true);
