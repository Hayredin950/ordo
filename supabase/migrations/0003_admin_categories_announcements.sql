-- Ordo — the admin role, admin-managed categories, and announcements.
--
-- Same posture as 0001: the table is the source of truth, row level security
-- decides who may touch a row, and anything that has to read across users goes
-- through a SECURITY DEFINER function that checks `is_admin()` first and returns
-- only what a dashboard needs.

-- ---------------------------------------------------------------------------
-- profiles.role — 'user' or 'admin'. The founder's address is promoted here and
-- again on every auth.users insert/update, so the role survives a re-signup.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin'));

create or replace function public.is_founder_email(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_email, ''))) = 'hayredin.950@gmail.com';
$$;

update public.profiles
   set role = 'admin'
 where public.is_founder_email(email)
   and role <> 'admin';

-- Rewritten from 0001 only to carry `role`. The conflict branch promotes but
-- never demotes: an admin added by hand keeps the role on their next login.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url, provider, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      ''
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', ''),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    case when public.is_founder_email(new.email) then 'admin' else 'user' end
  )
  on conflict (id) do update
    set email      = excluded.email,
        name       = case when profiles.name = '' then excluded.name else profiles.name end,
        avatar_url = case when profiles.avatar_url = '' then excluded.avatar_url else profiles.avatar_url end,
        provider   = excluded.provider,
        role       = case when excluded.role = 'admin' then 'admin' else profiles.role end;
  return new;
end;
$$;

-- The predicate every admin policy and RPC is built on. SECURITY DEFINER so a
-- policy on `profiles` can call it without recursing into its own RLS.
create or replace function public.is_admin(p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles
     where id = coalesce(p_user, auth.uid())
       and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- app_categories — the admin's category list. The six built-ins stay in
-- src/lib/ordo.ts so a signed-out browser still renders; a row here with the
-- same id overrides one, and a row with a new id adds one. Colour is any CSS
-- colour, icon is a lucide component name the client resolves against a fixed
-- registry (an unknown name falls back rather than crashing).
-- ---------------------------------------------------------------------------
create table if not exists public.app_categories (
  id         text primary key,
  label      text not null,
  color      text not null default 'oklch(0.75 0.16 62)',
  icon       text not null default 'Circle',
  sort       integer not null default 100,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_categories_id_slug check (id ~ '^[a-z][a-z0-9_-]{1,30}$'),
  constraint app_categories_label_len check (char_length(trim(label)) between 1 and 40),
  constraint app_categories_color_len check (char_length(color) between 3 and 60),
  constraint app_categories_icon_len check (icon ~ '^[A-Za-z][A-Za-z0-9]{0,40}$')
);

-- ---------------------------------------------------------------------------
-- announcements — a line the admin can put in front of every signed-in user.
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default '',
  body       text not null,
  level      text not null default 'info',
  active     boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint announcements_level_check check (level in ('info', 'warning', 'success')),
  constraint announcements_body_len check (char_length(trim(body)) between 1 and 500)
);
create index if not exists announcements_active_idx
  on public.announcements (active, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security. Both new tables are read-by-everyone / written-by-admins,
-- which is the first intentional exception to 0001's owner-only default — the
-- rows are app configuration, not user data.
-- ---------------------------------------------------------------------------
alter table public.app_categories enable row level security;
alter table public.announcements  enable row level security;

drop policy if exists "app_categories: read all" on public.app_categories;
create policy "app_categories: read all" on public.app_categories
  for select to authenticated using (true);
drop policy if exists "app_categories: admin write" on public.app_categories;
create policy "app_categories: admin write" on public.app_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "announcements: read active" on public.announcements;
create policy "announcements: read active" on public.announcements
  for select to authenticated using (active or public.is_admin());
drop policy if exists "announcements: admin write" on public.announcements;
create policy "announcements: admin write" on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Library moderation: authors could already delete their own rows, admins can
-- now delete anyone's.
drop policy if exists "public_templates: admin delete" on public.public_templates;
create policy "public_templates: admin delete" on public.public_templates
  for delete to authenticated using (public.is_admin());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists app_categories_touch on public.app_categories;
create trigger app_categories_touch
  before update on public.app_categories
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- admin_overview — every number the dashboard shows, in one round trip. Reads
-- across all users, hence SECURITY DEFINER plus the is_admin() gate.
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users',            (select count(*) from profiles),
    'admins',           (select count(*) from profiles where role = 'admin'),
    'new_7d',           (select count(*) from profiles where created_at > now() - interval '7 days'),
    'documents',        (select count(*) from user_state),
    'active_24h',       (select count(*) from user_state where updated_at > now() - interval '24 hours'),
    'active_7d',        (select count(*) from user_state where updated_at > now() - interval '7 days'),
    'categories',       (select count(*) from app_categories),
    'challenges',       (select count(*) from challenges),
    'challenge_members',(select count(*) from challenge_members),
    'pairings',         (select count(*) from pairings),
    'templates',        (select count(*) from public_templates),
    'letters_pending',  (select count(*) from future_letters where not delivered),
    'telegram_linked',  (select count(*) from telegram_links),
    'slack_linked',     (select count(*) from slack_links),
    'announcements',    (select count(*) from announcements where active),
    'notifications_7d', (select count(*) from notification_log where sent_at > now() - interval '7 days'),
    'avg_weekly',       (
      select coalesce(round(avg(w))::int, 0)
        from (select public.weekly_pct(user_id) as w from user_state) q
       where w is not null
    ),
    'series', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'day',     to_char(d.day, 'MM-DD'),
            'signups', (select count(*) from profiles p where p.created_at::date = d.day::date),
            'active',  (select count(*) from user_state u where u.updated_at::date = d.day::date)
          )
          order by d.day
        ),
        '[]'::jsonb
      )
      from generate_series(current_date - 13, current_date, interval '1 day') as d(day)
    )
  ) into v_out;

  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_list_users — the user table. Returns the profile plus the same weekly
-- score peers already see, never a document. `blocks` is a size signal so an
-- empty account is obvious at a glance.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_search text default '',
  p_limit  integer default 50
)
returns table (
  id          uuid,
  email       text,
  name        text,
  provider    text,
  role        text,
  created_at  timestamptz,
  last_active timestamptz,
  weekly      integer,
  telegram    boolean,
  slack       boolean,
  blocks      integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return query
    select p.id,
           p.email,
           p.name,
           p.provider,
           p.role,
           p.created_at,
           s.updated_at,
           public.weekly_pct(p.id),
           exists (select 1 from telegram_links t where t.user_id = p.id),
           exists (select 1 from slack_links l where l.user_id = p.id),
           coalesce((
             select sum(
                      case when jsonb_typeof(r.value) = 'array'
                           then jsonb_array_length(r.value)
                           else 0 end
                    )::int
               from jsonb_each(
                      case when jsonb_typeof(s.state -> 'routine') = 'object'
                           then s.state -> 'routine'
                           else '{}'::jsonb end
                    ) as r
           ), 0)
      from profiles p
      left join user_state s on s.user_id = p.id
     where coalesce(trim(p_search), '') = ''
        or p.email ilike '%' || trim(p_search) || '%'
        or p.name  ilike '%' || trim(p_search) || '%'
     order by p.created_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_set_role — promote or demote. Two guards stop the app from ending up
-- with no way back in: you cannot demote yourself, and the founder address is
-- permanent.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_role not in ('user', 'admin') then
    raise exception 'Unknown role %', p_role using errcode = '22023';
  end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'You cannot remove your own admin access' using errcode = '42501';
  end if;
  if p_role <> 'admin'
     and exists (select 1 from profiles where id = p_user and public.is_founder_email(email)) then
    raise exception 'The founder account cannot be demoted' using errcode = '42501';
  end if;

  update profiles set role = p_role where id = p_user;
  if not found then
    raise exception 'No such user' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Same rule as 0001: every SECURITY DEFINER function is locked down and
-- re-granted to exactly the role that calls it. `is_admin` has to be executable
-- by `authenticated` because the RLS policies above call it.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.is_founder_email(text),
  public.is_admin(uuid),
  public.admin_overview(),
  public.admin_list_users(text, integer),
  public.admin_set_role(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.is_admin(uuid),
  public.admin_overview(),
  public.admin_list_users(text, integer),
  public.admin_set_role(uuid, text)
to authenticated;

-- The tables are configuration: readable by any signed-in client, writable only
-- through the admin policies above.
grant select, insert, update, delete on public.app_categories to authenticated;
grant select, insert, update, delete on public.announcements  to authenticated;
grant all on public.app_categories to service_role;
grant all on public.announcements  to service_role;
