-- Ordo — the parts of Supabase that live outside these migrations.
--
-- Enough of auth.users, auth.uid() and the three Supabase roles to run 0001-0006
-- on a scratch cluster. auth.uid() reads a GUC, so a test impersonates a user
-- with `set app.uid = '<uuid>'`.

-- Roles are cluster-wide, not per-database, so a second run against the same
-- cluster would fail on `create role` alone. Skip the ones already there.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data  jsonb default '{}'::jsonb,
  created_at         timestamptz default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.uid', true), '')::uuid;
$$;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('app.jwt', true), '')::jsonb, '{}'::jsonb);
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('app.role', true), ''), 'authenticated');
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
