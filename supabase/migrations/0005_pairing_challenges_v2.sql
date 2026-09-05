-- Ordo — Phase 1: pairing consent flow, challenges v2, shared scoring.
-- Security posture matches 0001/0003: SECURITY DEFINER, search_path
-- pinned, auth.uid() checks in every function body.

-- ---------------------------------------------------------------------------
-- 1. Pairing requests (consent flow)
-- ---------------------------------------------------------------------------
create table if not exists public.pairing_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users (id) on delete cascade,
  target_email  text not null default '',
  status        text not null default 'pending'
                check (status in ('pending','accepted','declined')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz
);

create index if not exists pairing_requests_target_idx
  on public.pairing_requests (target_email, status);

-- ---------------------------------------------------------------------------
-- 2. Pairings — add id, keep symmetric uniqueness
-- ---------------------------------------------------------------------------
alter table public.pairings
  add column if not exists id uuid default gen_random_uuid();

alter table public.pairings
  drop constraint if exists pairings_pkey,
  add primary key (id);

create unique index if not exists pairings_symmetric_unique_idx
  on public.pairings (least(user_a, user_b), greatest(user_a, user_b));

-- ---------------------------------------------------------------------------
-- 3. Challenges — extended fields
-- ---------------------------------------------------------------------------
alter table public.challenges
  add column if not exists description text default '',
  add column if not exists category text default 'general',
  add column if not exists status text not null default 'active'
    check (status in ('draft','upcoming','active','completed','cancelled')),
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public','private')),
  add column if not exists invite_code text,
  add column if not exists max_participants integer,
  add column if not exists updated_at timestamptz not null default now();

alter table public.challenges
  alter column starts_on type timestamptz using starts_on::timestamptz,
  alter column ends_on type timestamptz using ends_on::timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Challenge members — new table with tracking fields
-- ---------------------------------------------------------------------------
drop table if exists public.challenge_members cascade;

create table if not exists public.challenge_members (
  id             uuid primary key default gen_random_uuid(),
  challenge_id   uuid not null references public.challenges (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  joined_at      timestamptz not null default now(),
  left_at        timestamptz,
  status         text not null default 'active'
                   check (status in ('active','left','removed')),
  final_score    numeric,
  final_rank     integer,
  created_at     timestamptz not null default now()
);

create index if not exists challenge_members_user_idx
  on public.challenge_members (user_id);

create index if not exists challenge_members_challenge_status_idx
  on public.challenge_members (challenge_id, status);

-- ---------------------------------------------------------------------------
-- 5. Challenge daily stats — anti-gaming floor + consistency tracking
-- ---------------------------------------------------------------------------
create table if not exists public.challenge_daily_stats (
  challenge_id      uuid not null references public.challenges (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  date              date not null,
  planned_minutes   integer not null default 0,
  completed_minutes integer not null default 0,
  completion_pct    numeric not null default 0,
  met_minimum       boolean not null default false,
  created_at        timestamptz not null default now(),
  primary key (challenge_id, user_id, date)
);

-- ---------------------------------------------------------------------------
-- 6. Shared scoring function
-- ---------------------------------------------------------------------------
create or replace function public.completion_pct(
  p_user uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_state jsonb;
  v_sum numeric := 0;
  v_count integer := 0;
  v_day date;
  v_dow text;
  v_blocks jsonb;
  v_log jsonb;
  v_total numeric;
  v_block_count integer;
begin
  select state into v_state from public.user_state where user_id = p_user;
  if v_state is null or v_state -> 'routine' is null then
    return 0;
  end if;

  for v_day in select d::date from generate_series(p_start_at::date, p_end_at::date, '1 day'::interval) as d
  loop
    v_dow := extract(dow from v_day)::integer::text;
    v_blocks := coalesce(v_state -> 'routine' -> v_dow, '[]'::jsonb);
    v_block_count := jsonb_array_length(v_blocks);
    if v_block_count = 0 then
      continue;
    end if;
    v_log := coalesce(v_state -> 'log' -> to_char(v_day, 'YYYY-MM-DD'), '{}'::jsonb);
    select coalesce(sum(coalesce((v_log ->> (b ->> 'id'))::numeric, 0)), 0)
      into v_total
      from jsonb_array_elements(v_blocks) as b;
    v_sum := v_sum + v_total / v_block_count;
    v_count := v_count + 1;
  end loop;

  return coalesce(round(v_sum / nullif(v_count, 0)), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Pairing RPCs
-- ---------------------------------------------------------------------------
drop function if exists public.pair_with_email(text);
create function public.pair_with_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_target uuid;
  v_req  uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'Invalid email' using errcode = '22023'; end if;

  select id into v_target from public.profiles where lower(email) = lower(trim(p_email));

  insert into public.pairing_requests (requester_id, target_email)
    values (v_uid, trim(p_email))
    returning id into v_req;

  -- Fast-pair path: if target exists and is not the requester, create the pair immediately.
  if v_target is not null and v_target <> v_uid then
    insert into public.pairings (user_a, user_b)
      values (least(v_uid, v_target), greatest(v_uid, v_target))
      on conflict (user_a, user_b) do nothing;
  end if;

  return v_req;
end;
$$;

create or replace function public.respond_to_pairing_request(
  p_request_id uuid,
  p_response text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.pairing_requests%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  select * into v_req from public.pairing_requests where id = p_request_id;
  if v_req is null then raise exception 'Request not found' using errcode = 'P0002'; end if;

  -- Only the target can respond.
  if v_req.target_email <> (select lower(email) from public.profiles where id = v_uid) then
    raise exception 'Not authorized to respond' using errcode = '42501';
  end if;

  if p_response = 'accept' then
    insert into public.pairings (user_a, user_b)
      values (least(v_req.requester_id, v_uid), greatest(v_req.requester_id, v_uid))
      on conflict (user_a, user_b) do nothing;
    update public.pairing_requests set status = 'accepted', responded_at = now() where id = p_request_id;
  else
    update public.pairing_requests set status = 'declined', responded_at = now() where id = p_request_id;
  end if;
end;
$$;

create or replace function public.unpair_user(p_peer uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  delete from public.pairings
   where (user_a = least(auth.uid(), p_peer) and user_b = greatest(auth.uid(), p_peer));
end;
$$;

drop function if exists public.unpair(uuid);

create or replace function public.get_accountability_partners()
returns table (id uuid, name text, email text, weekly integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.email, public.weekly_pct(p.id)
    from public.pairings pr
    join public.profiles p on p.id = case when pr.user_a = auth.uid() then pr.user_b else pr.user_a end
   where auth.uid() in (pr.user_a, pr.user_b)
    order by p.name;
$$;

-- ---------------------------------------------------------------------------
-- 8. Challenge RPCs (enhanced)
-- ---------------------------------------------------------------------------
drop function if exists public.challenge_leaderboard(uuid);
drop function if exists public.create_challenge(text, integer);
create or replace function public.create_challenge(
  p_name text,
  p_category text default 'general',
  p_description text default '',
  p_start_at timestamptz default now(),
  p_end_at timestamptz default now() + interval '30 days',
  p_visibility text default 'public',
  p_max_participants integer default null
)
returns public.challenges
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.challenges;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 80 then raise exception 'Invalid challenge name' using errcode = '22023'; end if;
  if p_visibility not in ('public','private') then raise exception 'Invalid visibility' using errcode = '22023'; end if;
  if p_end_at <= p_start_at then raise exception 'End must be after start' using errcode = '22023'; end if;
  if p_max_participants is not null and p_max_participants < 2 then raise exception 'Must allow at least 2 participants' using errcode = '22023'; end if;

  insert into public.challenges (owner_id, name, category, description, start_at, end_at, visibility, max_participants, status)
    values (v_uid, trim(p_name), p_category, p_description, p_start_at, p_end_at, p_visibility, p_max_participants, 'upcoming')
    returning * into v_row;

  insert into public.challenge_members (challenge_id, user_id) values (v_row.id, v_uid) on conflict do nothing;
  return v_row;
end;
$$;

create or replace function public.join_challenge(p_challenge uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ch public.challenges;
  v_count integer;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into v_ch from public.challenges where id = p_challenge;
  if v_ch is null then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if v_ch.status <> 'active' then raise exception 'Challenge is not active' using errcode = 'P0002'; end if;
  if v_ch.visibility = 'private' then raise exception 'Private challenges require an invite code' using errcode = 'P0002'; end if;

  select count(*)::integer into v_count
    from public.challenge_members where challenge_id = p_challenge and status = 'active';
  if v_ch.max_participants is not null and v_count >= v_ch.max_participants then
    raise exception 'Challenge is full' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.challenge_members where challenge_id = p_challenge and user_id = v_uid and status = 'active') then
    raise exception 'Already a member' using errcode = 'P0002';
  end if;
  insert into public.challenge_members (challenge_id, user_id) values (p_challenge, v_uid);
end;
$$;

create or replace function public.leave_challenge(p_challenge uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  update public.challenge_members set status = 'left', left_at = now()
   where challenge_id = p_challenge and user_id = auth.uid() and status = 'active';
end;
$$;

create or replace function public.get_challenge(p_challenge uuid)
returns public.challenges
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.challenges where id = p_challenge;
$$;

create or replace function public.get_challenge_leaderboard(p_challenge uuid)
returns table (user_id uuid, name text, score numeric, rank integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  return query
  with ranked as (
    select cm.user_id, coalesce(cm.final_score, 0) as score,
           rank() over (order by coalesce(cm.final_score, 0) desc) as rnk
      from public.challenge_members cm
     where cm.challenge_id = p_challenge and cm.status = 'active'
  )
  select r.user_id, coalesce(p.name, 'Anonymous'), r.score, r.rnk
    from ranked r join public.profiles p on p.id = r.user_id
   where r.rnk <= 5 or r.user_id = auth.uid()
   order by r.rnk;
end;
$$;

create or replace function public.challenge_score(p_user uuid, p_challenge uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_completion numeric;
  v_consistency numeric;
  v_participation numeric;
  v_score numeric;
begin
  v_completion := public.completion_pct(p_user,
    (select start_at from public.challenges where id = p_challenge),
    (select end_at from public.challenges where id = p_challenge));

  select coalesce(round(avg(case when met_minimum then 100 else 0 end)), 0)
    into v_consistency
    from public.challenge_daily_stats
    where challenge_id = p_challenge and user_id = p_user;

  select coalesce(round(100.0 * count(*) / nullif(
    (select extract(day from (end_at - start_at)) from public.challenges where id = p_challenge), 0)
  , 0), 0) into v_participation
    from public.challenge_daily_stats
    where challenge_id = p_challenge and user_id = p_user;

  v_score := v_completion * 0.70 + v_consistency * 0.20 + v_participation * 0.10;
  return round(v_score);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.pair_with_email(text),
  public.respond_to_pairing_request(uuid, text),
  public.unpair_user(uuid),
  public.get_accountability_partners()
from public, anon, authenticated;
grant execute on function
  public.pair_with_email(text),
  public.respond_to_pairing_request(uuid, text),
  public.unpair_user(uuid),
  public.get_accountability_partners()
to authenticated;

revoke execute on function
  public.create_challenge(text, text, text, timestamptz, timestamptz, text, integer),
  public.join_challenge(uuid),
  public.leave_challenge(uuid),
  public.get_challenge(uuid),
  public.get_challenge_leaderboard(uuid),
  public.challenge_score(uuid, uuid)
from public, anon, authenticated;
grant execute on function
  public.create_challenge(text, text, text, timestamptz, timestamptz, text, integer),
  public.join_challenge(uuid),
  public.leave_challenge(uuid),
  public.get_challenge(uuid),
  public.get_challenge_leaderboard(uuid),
  public.challenge_score(uuid, uuid)
to authenticated;

revoke execute on function public.completion_pct(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.completion_pct(uuid, timestamptz, timestamptz) to service_role;