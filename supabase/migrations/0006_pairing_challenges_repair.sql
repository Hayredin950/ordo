-- Ordo — 0006: repair 0005 and finish pairing + challenges.
--
-- 0005 is already applied to the live project, so everything here is written to
-- run once against data in place. Columns are renamed rather than re-added, the
-- unique constraint 0005 dropped is restored additively, and the three functions
-- 0005 removed come back as thin shims so mobile builds already in the wild keep
-- working. No table holding rows is dropped.
--
-- What 0005 got wrong, and where it is fixed below:
--   §1  challenges.starts_on/ends_on were never renamed to start_at/end_at, so
--       create_challenge() and challenge_score() referenced columns that do not
--       exist.
--   §2  pairings lost its unique index on (user_a, user_b), so every
--       `on conflict (user_a, user_b)` raised 42P10 — both pairing write paths.
--   §5  scoring re-read the whole user_state document per member per render, and
--       ignored `overrides`, so a partner's % disagreed with what they saw.
--   §6  challenge status was a stored string nothing ever advanced, so no
--       challenge created after 0005 could be joined.
--   §7  final_score was never written and never protected.
--   §10 the three new tables had neither RLS nor grants.

-- ---------------------------------------------------------------------------
-- 1. challenges — the columns 0005's own functions were written against.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'challenges'
                and column_name = 'starts_on') then
    alter table public.challenges rename column starts_on to start_at;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'challenges'
                and column_name = 'ends_on') then
    alter table public.challenges rename column ends_on to end_at;
  end if;
end $$;

alter table public.challenges
  add column if not exists min_daily_minutes integer not null default 30,
  add column if not exists cancelled_at timestamptz,
  add column if not exists finalized_at timestamptz;

alter table public.challenges alter column start_at set default now();

-- A zero-or-negative window would fail the constraint below. 0001 could not
-- produce one (it always added 7-90 days), but a hand-edited row could.
update public.challenges set end_at = start_at + interval '30 days'
 where end_at <= start_at;

alter table public.challenges drop constraint if exists challenges_window_ck;
alter table public.challenges add constraint challenges_window_ck
  check (end_at > start_at);

alter table public.challenges drop constraint if exists challenges_floor_ck;
alter table public.challenges add constraint challenges_floor_ck
  check (min_daily_minutes between 5 and 720);

-- Invite codes move out of `challenges`. 0001 grants `select` on that table to
-- every authenticated user and its policy is `using (true)`, so an invite_code
-- column there is a public column — the code would have been readable by the
-- people it is meant to exclude.
create table if not exists public.challenge_invites (
  challenge_id uuid primary key references public.challenges (id) on delete cascade,
  code         text not null unique,
  created_at   timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'challenges'
                and column_name = 'invite_code') then
    insert into public.challenge_invites (challenge_id, code)
    select id, invite_code from public.challenges
     where invite_code is not null and invite_code <> ''
    on conflict do nothing;
    alter table public.challenges drop column invite_code;
  end if;
end $$;

-- Status stops being stored. A column that has to be advanced by a job is a
-- column that is wrong whenever the job has not run yet — which is why nothing
-- created after 0005 could be joined. It is derived from the dates instead
-- (§6), and the two facts that genuinely cannot be derived get their own
-- columns: cancelled_at and finalized_at.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'challenges'
                and column_name = 'status') then
    update public.challenges
       set cancelled_at = coalesce(cancelled_at, updated_at, created_at, now())
     where status = 'cancelled';
    update public.challenges
       set finalized_at = coalesce(finalized_at, updated_at, created_at, now())
     where status = 'completed';
    alter table public.challenges drop column status;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. pairings — restore the constraint the ON CONFLICT clauses need.
--
-- 0005 replaced `primary key (user_a, user_b)` with `primary key (id)` and a
-- unique index on `(least(...), greatest(...))`. ON CONFLICT inference cannot
-- match an expression index, so `on conflict (user_a, user_b)` raised 42P10 and
-- every pairing write failed. `check (user_a < user_b)` from 0001 already makes
-- a plain unique on the pair symmetric, so the expression index is redundant.
-- ---------------------------------------------------------------------------
delete from public.pairings p
 using public.pairings q
 where p.user_a = q.user_a and p.user_b = q.user_b and p.ctid > q.ctid;

alter table public.pairings drop constraint if exists pairings_user_pair_uk;
alter table public.pairings add constraint pairings_user_pair_uk
  unique (user_a, user_b);

drop index if exists public.pairings_symmetric_unique_idx;

-- ---------------------------------------------------------------------------
-- 3. pairing_requests — a resolved target, normalised email, spam ceiling.
--
-- A text email as the only handle meant the inbox was a case-sensitive string
-- match (0005 stored `trim(p_email)` and compared it against `lower(email)`, so
-- anyone invited as Foo@Bar.com could not accept), and it left the table as a
-- plaintext address dump.
-- ---------------------------------------------------------------------------
alter table public.pairing_requests
  add column if not exists target_id   uuid references auth.users (id) on delete cascade,
  add column if not exists expires_at  timestamptz not null default now() + interval '30 days';

update public.pairing_requests
   set target_email = lower(trim(target_email))
 where target_email <> lower(trim(target_email));

update public.pairing_requests r
   set target_id = p.id
  from public.profiles p
 where r.target_id is null
   and p.email is not null
   and lower(p.email) = r.target_email;

-- Collapse duplicate pending invitations before the index that forbids them.
delete from public.pairing_requests p
 using public.pairing_requests q
 where p.status = 'pending' and q.status = 'pending'
   and p.requester_id = q.requester_id and p.target_email = q.target_email
   and p.ctid > q.ctid;

create unique index if not exists pairing_requests_pending_uk
  on public.pairing_requests (requester_id, target_email)
  where status = 'pending';

create index if not exists pairing_requests_target_id_idx
  on public.pairing_requests (target_id, status);

-- ---------------------------------------------------------------------------
-- 4. challenge_members — one row per member, so leaving cannot erase a result.
--
-- 0005 had no unique constraint and join_challenge() inserted a fresh row
-- whenever no active one existed, so leave/rejoin loops accumulated rows and —
-- because the leaderboard filters status = 'active' — leaving was a free way to
-- erase a bad rank. Join is an upsert from here on and a left member keeps their
-- row and still gets finalised.
-- ---------------------------------------------------------------------------
delete from public.challenge_members m
 using (
   select id,
          row_number() over (
            partition by challenge_id, user_id
            order by (status = 'active') desc, joined_at desc, id
          ) as rn
     from public.challenge_members
 ) dupe
 where dupe.id = m.id and dupe.rn > 1;

alter table public.challenge_members drop constraint if exists challenge_members_uk;
alter table public.challenge_members add constraint challenge_members_uk
  unique (challenge_id, user_id);

-- challenge_daily_stats is replaced by daily_scores (§5): the same facts keyed
-- by the user instead of by the challenge, so they cannot drift from the
-- document and one write path serves weekly %, streaks, the heatmap and every
-- challenge window. Nothing ever wrote the old table, so it should be empty —
-- but check rather than assume, since this runs against live data.
do $$
begin
  if not exists (select 1 from public.challenge_daily_stats limit 1) then
    drop table public.challenge_daily_stats;
  else
    raise notice 'challenge_daily_stats has rows — left in place, migrate then drop by hand';
  end if;
exception
  when undefined_table then null;
end $$;

-- ---------------------------------------------------------------------------
-- 5. daily_scores — one materialised fact row per user per day.
--
-- 0005's completion_pct() pulled the entire user_state document (routine, log,
-- goals, journal) once per member and walked it day by day, so a leaderboard was
-- O(members x days) full-document reads per render and could not be indexed. It
-- also read only `routine`, never `overrides`, so any day the user had
-- overridden scored against the wrong block list and their partner's number
-- disagreed with the one they saw themselves.
--
-- Written by save_state() for the dates a save actually touched, which is the
-- only place the document changes.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_scores (
  user_id           uuid not null references auth.users (id) on delete cascade,
  date              date not null,
  block_count       integer not null default 0,
  planned_minutes   integer not null default 0,
  completed_minutes integer not null default 0,
  completion_pct    numeric(5,2) not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (user_id, date)
);

-- "HH:MM" pair to minutes. A block ending before it starts is read as crossing
-- midnight; anything unparseable is zero rather than an exception, so one
-- malformed block cannot fail a whole leaderboard.
create or replace function public.block_minutes(p_start text, p_end text)
returns integer
language plpgsql
immutable
as $$
declare
  v_start time;
  v_end   time;
begin
  v_start := p_start::time;
  v_end   := p_end::time;
  return (((extract(epoch from v_end) - extract(epoch from v_start))::integer / 60) + 1440) % 1440;
exception
  when others then return 0;
end;
$$;

-- One day of a document, scored exactly as dayScore() in src/lib/ordo.ts does:
-- overrides[date] beats routine[dow], and the day's percentage is the mean over
-- its blocks, so the number a partner sees is the number the user sees.
create or replace function public.day_facts(p_state jsonb, p_day date)
returns table (
  block_count       integer,
  planned_minutes   integer,
  completed_minutes integer,
  completion_pct    numeric
)
language sql
immutable
as $$
  with src as (
    select coalesce(
             p_state -> 'overrides' -> to_char(p_day, 'YYYY-MM-DD'),
             p_state -> 'routine'   -> (extract(dow from p_day)::integer::text),
             '[]'::jsonb
           ) as blocks,
           coalesce(p_state -> 'log' -> to_char(p_day, 'YYYY-MM-DD'), '{}'::jsonb) as log
  ),
  scored as (
    select public.block_minutes(b ->> 'start', b ->> 'end') as mins,
           least(greatest(
             case when (src.log ->> (b ->> 'id')) ~ '^[0-9]+(\.[0-9]+)?$'
                  then (src.log ->> (b ->> 'id'))::numeric
                  else 0 end, 0), 100) as pct
      from src
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(src.blocks) = 'array' then src.blocks else '[]'::jsonb end
      ) as b
  )
  select count(*)::integer,
         coalesce(sum(mins), 0)::integer,
         coalesce(sum(mins * pct / 100.0), 0)::integer,
         case when count(*) = 0 then 0::numeric else round(avg(pct), 2) end
    from scored;
$$;

-- Recompute an explicit set of days. Future days are never materialised: a day
-- that has not happened yet would sit at 0% and drag every average that spans it.
create or replace function public.refresh_daily_scores(p_user uuid, p_days date[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state jsonb;
  v_days  date[];
  v_n     integer := 0;
begin
  if p_user is null or p_days is null or array_length(p_days, 1) is null then
    return 0;
  end if;

  select array_agg(distinct d) into v_days
    from unnest(p_days) as d
   where d <= current_date;
  if v_days is null then return 0; end if;

  select state into v_state from public.user_state where user_id = p_user;

  delete from public.daily_scores
   where user_id = p_user and date = any (v_days);

  if v_state is null or jsonb_typeof(v_state) <> 'object' then
    return 0;
  end if;

  insert into public.daily_scores
    (user_id, date, block_count, planned_minutes, completed_minutes, completion_pct, updated_at)
  select p_user, d, f.block_count, f.planned_minutes, f.completed_minutes, f.completion_pct, now()
    from unnest(v_days) as d
    cross join lateral public.day_facts(v_state, d) as f
   where f.block_count > 0;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.refresh_daily_scores(p_user uuid, p_from date, p_to date)
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.refresh_daily_scores(
    p_user,
    (select array_agg(d::date) from generate_series(p_from, p_to, '1 day'::interval) as d)
  );
$$;

/** Date-keyed members of two objects whose values differ — what a save touched. */
create or replace function public.changed_date_keys(p_old jsonb, p_new jsonb)
returns setof date
language sql
immutable
as $$
  select k::date
    from (
      select jsonb_object_keys(case when jsonb_typeof(p_old) = 'object' then p_old else '{}'::jsonb end) as k
      union
      select jsonb_object_keys(case when jsonb_typeof(p_new) = 'object' then p_new else '{}'::jsonb end)
    ) keys
   where k ~ '^\d{4}-\d{2}-\d{2}$'
     and (coalesce(p_old, '{}'::jsonb) -> k) is distinct from (coalesce(p_new, '{}'::jsonb) -> k);
$$;

-- The document's three write paths now keep daily_scores in step. save_state is
-- otherwise unchanged from 0004 (history cap of 30, redo cleared on write).
create or replace function public.save_state(p_state jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_prev jsonb;
  v_hist jsonb;
  v_days date[];
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'state must be a JSON object' using errcode = '22023';
  end if;

  select state, history into v_prev, v_hist
    from public.user_state where user_id = v_uid for update;

  if v_prev is null then
    insert into public.user_state (user_id, state, history, redo)
      values (v_uid, p_state, '[]'::jsonb, '[]'::jsonb);
    perform public.refresh_daily_scores(v_uid, current_date - 180, current_date);
    return;
  end if;

  if v_prev = p_state then
    update public.user_state set updated_at = now() where user_id = v_uid;
    return;
  end if;

  v_hist := coalesce(v_hist, '[]'::jsonb) || jsonb_build_array(v_prev);
  while jsonb_array_length(v_hist) > 30 loop
    v_hist := v_hist - 0;
  end loop;

  update public.user_state
     set state = p_state, history = v_hist, redo = '[]'::jsonb, updated_at = now()
   where user_id = v_uid;

  -- A routine edit moves every day of that weekday, so it falls back to the
  -- rolling window; a log tick or a single-date override moves one date.
  if (v_prev -> 'routine') is distinct from (p_state -> 'routine') then
    perform public.refresh_daily_scores(v_uid, current_date - 180, current_date);
  else
    select array_agg(d) into v_days
      from (
        select public.changed_date_keys(v_prev -> 'log', p_state -> 'log') as d
        union
        select public.changed_date_keys(v_prev -> 'overrides', p_state -> 'overrides')
      ) touched;
    perform public.refresh_daily_scores(v_uid, coalesce(v_days, '{}'::date[]));
  end if;
end;
$$;

-- undo/redo swap the whole document, so there is nothing cheaper to diff than
-- the rolling window.
create or replace function public.undo_state()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_hist jsonb;
  v_len  integer;
  v_prev jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select history into v_hist
    from public.user_state where user_id = v_uid for update;

  v_len := coalesce(jsonb_array_length(coalesce(v_hist, '[]'::jsonb)), 0);
  if v_len = 0 then
    raise exception 'Nothing to undo' using errcode = 'P0002';
  end if;

  v_prev := v_hist -> (v_len - 1);
  update public.user_state
     set state = v_prev,
         history = v_hist - (v_len - 1),
         redo = coalesce(redo, '[]'::jsonb) || jsonb_build_array(state),
         updated_at = now()
   where user_id = v_uid;

  perform public.refresh_daily_scores(v_uid, current_date - 180, current_date);
  return v_prev;
end;
$$;

create or replace function public.redo_state()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_redo jsonb;
  v_len  integer;
  v_next jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select redo into v_redo
    from public.user_state where user_id = v_uid for update;

  v_len := coalesce(jsonb_array_length(coalesce(v_redo, '[]'::jsonb)), 0);
  if v_len = 0 then
    raise exception 'Nothing to redo' using errcode = 'P0002';
  end if;

  v_next := v_redo -> (v_len - 1);
  update public.user_state
     set state = v_next,
         history = coalesce(history, '[]'::jsonb) || jsonb_build_array(state),
         redo = v_redo - (v_len - 1),
         updated_at = now()
   where user_id = v_uid;

  perform public.refresh_daily_scores(v_uid, current_date - 180, current_date);
  return v_next;
end;
$$;

-- Backfill every existing document once, so scores are not empty until each
-- user's next save.
select public.refresh_daily_scores(user_id, current_date - 180, current_date)
  from public.user_state;

-- ---------------------------------------------------------------------------
-- 6. Scoring reads. Both features now share one source of truth, which is what
-- §1 of the plan asked for and 0005 did not deliver: pairing called weekly_pct()
-- and challenges called completion_pct(), two implementations of one formula.
-- ---------------------------------------------------------------------------
create or replace function public.weekly_pct(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select round(avg(ds.completion_pct))::integer
    from public.daily_scores ds
   where ds.user_id = p_user
     and ds.date between current_date - 6 and current_date;
$$;

create or replace function public.completion_pct(
  p_user     uuid,
  p_start_at timestamptz,
  p_end_at   timestamptz
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(round(avg(ds.completion_pct), 2), 0)
    from public.daily_scores ds
   where ds.user_id = p_user
     and ds.date between p_start_at::date and least(p_end_at::date, current_date);
$$;

/** Lifecycle from the dates, so it cannot be stale. 'draft' is unreachable
    until there is a publish flow; nothing in the app creates one. */
create or replace function public.challenge_status(
  p_start     timestamptz,
  p_end       timestamptz,
  p_cancelled timestamptz
)
returns text
language sql
stable
as $$
  select case
           when p_cancelled is not null then 'cancelled'
           when now() < p_start then 'upcoming'
           when now() > p_end then 'completed'
           else 'active'
         end;
$$;

/**
 * The 70/20/10 score for every member of a challenge in one pass — or for one
 * member when p_user is given. Three corrections to §4 as 0005 implemented it:
 *
 *   - Consistency counts days that met the floor in *completed* minutes. 0005
 *     tested planned_minutes >= 30, so planning half an hour a day and doing
 *     none of it scored 100% consistency.
 *   - Every component divides by the days of the member's window, not by the
 *     days they happened to plan. 0005 skipped unplanned days, which is exactly
 *     the "reward planning less work" failure §4 set out to prevent.
 *   - The window starts at joined_at, so joining on day 25 is scored on those
 *     days rather than inheriting credit for the whole month.
 */
create or replace function public.challenge_scores(
  p_challenge uuid,
  p_user      uuid default null
)
returns table (
  user_id       uuid,
  window_days   integer,
  active_days   integer,
  completion    numeric,
  consistency   numeric,
  participation numeric,
  score         numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with c as (
    select ch.start_at, ch.end_at, ch.min_daily_minutes
      from public.challenges ch where ch.id = p_challenge
  ),
  w as (
    select cm.user_id,
           greatest(c.start_at::date, cm.joined_at::date) as from_d,
           least(c.end_at::date, current_date,
                 coalesce(cm.left_at::date, 'infinity'::date)) as to_d,
           c.min_daily_minutes as floor_min
      from public.challenge_members cm
      cross join c
     where cm.challenge_id = p_challenge
       and cm.status in ('active', 'left')
       and (p_user is null or cm.user_id = p_user)
  ),
  agg as (
    select w.user_id,
           greatest(0, (w.to_d - w.from_d) + 1) as days,
           coalesce(sum(ds.completion_pct), 0) as sum_pct,
           count(ds.date) filter (where ds.completed_minutes >= w.floor_min) as floor_days,
           count(ds.date) filter (where ds.completed_minutes > 0) as busy_days
      from w
      left join public.daily_scores ds
        on ds.user_id = w.user_id and ds.date between w.from_d and w.to_d
     group by w.user_id, w.to_d, w.from_d
  )
  -- nullif on the divisor, so a window that has not opened yet reports null
  -- rather than a 0% that looks like failure.
  select agg.user_id,
         agg.days::integer,
         agg.busy_days::integer,
         round(agg.sum_pct / nullif(agg.days, 0), 1),
         round(100.0 * agg.floor_days / nullif(agg.days, 0), 1),
         round(100.0 * agg.busy_days / nullif(agg.days, 0), 1),
         round(0.70 * (agg.sum_pct / nullif(agg.days, 0))
             + 0.20 * (100.0 * agg.floor_days / nullif(agg.days, 0))
             + 0.10 * (100.0 * agg.busy_days / nullif(agg.days, 0)), 1)
    from agg;
$$;

-- ---------------------------------------------------------------------------
-- 7. Challenge RPCs.
-- ---------------------------------------------------------------------------
drop function if exists public.create_challenge(text, text, text, timestamptz, timestamptz, text, integer);

create or replace function public.create_challenge(
  p_name              text,
  p_category          text default 'general',
  p_description       text default '',
  p_start_at          timestamptz default null,
  p_end_at            timestamptz default null,
  p_visibility        text default 'public',
  p_max_participants  integer default null,
  p_min_daily_minutes integer default 30
)
returns public.challenges
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_start timestamptz := coalesce(p_start_at, now());
  v_end   timestamptz;
  v_row   public.challenges;
  v_code  text;
  v_try   integer;
  -- A client that sends an explicit null for an optional text field must land on
  -- the same value as one that omits it; a bare null would reach the not-null
  -- column and surface as 23502 instead of a readable message.
  v_cat   text := coalesce(nullif(trim(p_category), ''), 'general');
  v_vis   text := coalesce(nullif(trim(p_visibility), ''), 'public');
  v_floor integer := coalesce(p_min_daily_minutes, 30);
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  -- The web client sends an explicit null when the user does not pick dates,
  -- which would override a column default, so the fallback lives here instead.
  v_end := coalesce(p_end_at, v_start + interval '30 days');

  if coalesce(trim(p_name), '') = '' or length(p_name) > 80 then
    raise exception 'Invalid challenge name' using errcode = '22023';
  end if;
  if v_vis not in ('public', 'private') then
    raise exception 'Invalid visibility' using errcode = '22023';
  end if;
  if v_end <= v_start then
    raise exception 'End must be after start' using errcode = '22023';
  end if;
  if v_end > v_start + interval '365 days' then
    raise exception 'A challenge cannot run longer than a year' using errcode = '22023';
  end if;
  if p_max_participants is not null and p_max_participants < 2 then
    raise exception 'Must allow at least 2 participants' using errcode = '22023';
  end if;
  if v_floor not between 5 and 720 then
    raise exception 'Daily minimum must be 5-720 minutes' using errcode = '22023';
  end if;
  if v_cat <> 'general'
     and v_cat not in ('health', 'study', 'work', 'finance', 'spiritual', 'relationships')
     and not exists (select 1 from public.app_categories ac where ac.id = v_cat) then
    raise exception 'Unknown category' using errcode = '22023';
  end if;

  insert into public.challenges
    (owner_id, name, category, description, start_at, end_at,
     visibility, max_participants, min_daily_minutes, updated_at)
  values
    (v_uid, trim(p_name), v_cat, coalesce(trim(p_description), ''), v_start, v_end,
     v_vis, p_max_participants, v_floor, now())
  returning * into v_row;

  insert into public.challenge_members (challenge_id, user_id)
  values (v_row.id, v_uid)
  on conflict (challenge_id, user_id) do nothing;

  if v_vis = 'private' then
    -- Unambiguous alphabet: no O/0, no I/1/L. Retry on the unique violation, but
    -- bounded, so a constraint failure that is not a collision cannot spin.
    for v_try in 1..10 loop
      v_code := (
        select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                                 1 + floor(random() * 31)::integer, 1), '')
          from generate_series(1, 8)
      );
      begin
        insert into public.challenge_invites (challenge_id, code) values (v_row.id, v_code);
        exit;
      exception when unique_violation then
        if v_try = 10 then
          raise exception 'Could not allocate an invite code' using errcode = '40001';
        end if;
      end;
    end loop;
  end if;

  return v_row;
end;
$$;

/**
 * The join rules, in one place. Kept out of the client-callable surface on
 * purpose: if `p_private_ok` were a defaulted parameter of join_challenge(),
 * PostgREST would let a caller pass it and walk into a private challenge.
 */
create or replace function public.challenge_join_internal(
  p_challenge  uuid,
  p_private_ok boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_ch     public.challenges;
  v_count  integer;
  v_closes timestamptz;
  v_status text;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  select * into v_ch from public.challenges where id = p_challenge;
  if v_ch is null then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if v_ch.cancelled_at is not null then
    raise exception 'Challenge was cancelled' using errcode = 'P0002';
  end if;
  if now() > v_ch.end_at then
    raise exception 'Challenge has finished' using errcode = 'P0002';
  end if;
  if v_ch.visibility = 'private' and not p_private_ok then
    raise exception 'Private challenges require an invite code' using errcode = '42501';
  end if;

  -- Joining closes once a fifth of the run has elapsed. Scoring already starts
  -- at joined_at, so a late joiner gains nothing — but a five-day window has far
  -- more variance than a thirty-day one, and that alone would let someone drop
  -- in at the end and outrank a month of steady work.
  v_closes := v_ch.start_at + greatest(interval '1 day', (v_ch.end_at - v_ch.start_at) * 0.2);
  if now() > v_closes then
    raise exception 'Joining closed on %', to_char(v_closes, 'YYYY-MM-DD')
      using errcode = 'P0002';
  end if;

  select cm.status into v_status
    from public.challenge_members cm
   where cm.challenge_id = p_challenge and cm.user_id = v_uid;
  if v_status = 'active' then
    raise exception 'Already a member' using errcode = 'P0002';
  end if;
  if v_status = 'removed' then
    raise exception 'You were removed from this challenge' using errcode = '42501';
  end if;

  select count(*)::integer into v_count
    from public.challenge_members cm
   where cm.challenge_id = p_challenge and cm.status = 'active';
  if v_ch.max_participants is not null and v_count >= v_ch.max_participants then
    raise exception 'Challenge is full' using errcode = 'P0002';
  end if;

  -- Rejoining keeps the original joined_at, so the days spent away still count
  -- against the window rather than being scrubbed by a leave/rejoin loop.
  insert into public.challenge_members (challenge_id, user_id, joined_at, status, left_at)
  values (p_challenge, v_uid, now(), 'active', null)
  on conflict (challenge_id, user_id) do update
     set status    = 'active',
         left_at   = null,
         joined_at = least(challenge_members.joined_at, excluded.joined_at);
end;
$$;

create or replace function public.join_challenge(p_challenge uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.challenge_join_internal(p_challenge, false);
$$;

create or replace function public.join_challenge_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select ci.challenge_id into v_id
    from public.challenge_invites ci
   where upper(trim(ci.code)) = upper(trim(coalesce(p_code, '')));
  if v_id is null then raise exception 'No challenge with that code' using errcode = 'P0002'; end if;
  perform public.challenge_join_internal(v_id, true);
  return v_id;
end;
$$;

create or replace function public.leave_challenge(p_challenge uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  update public.challenge_members
     set status = 'left', left_at = now()
   where challenge_id = p_challenge and user_id = v_uid and status = 'active';

  if not found then
    raise exception 'You are not an active member of this challenge' using errcode = 'P0002';
  end if;
end;
$$;

/**
 * Cancelling is the owner's escape hatch and is deliberately not a delete: the
 * rows stay so members keep whatever history they built, and finalize_challenges
 * leaves final_score null, which reads as "no result" rather than "scored zero".
 */
create or replace function public.cancel_challenge(p_challenge uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ch  public.challenges;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  select * into v_ch from public.challenges where id = p_challenge;
  if v_ch is null then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if v_ch.owner_id <> v_uid then
    raise exception 'Only the owner can cancel this challenge' using errcode = '42501';
  end if;
  if v_ch.cancelled_at is not null then return; end if;
  if v_ch.finalized_at is not null then
    raise exception 'Challenge has already been scored' using errcode = 'P0002';
  end if;

  update public.challenges
     set cancelled_at = now(), updated_at = now()
   where id = p_challenge;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Challenge reads
--
-- Every one of these is a fresh signature, so each needs an explicit drop:
-- `create or replace` cannot change a function's return type, and 0005's
-- versions returned `public.challenges` or a `date`-typed row.
-- ---------------------------------------------------------------------------

drop function if exists public.get_challenge(uuid);
create function public.get_challenge(p_challenge uuid)
returns table (
  id                uuid,
  owner_id          uuid,
  name              text,
  category          text,
  description       text,
  start_at          timestamptz,
  end_at            timestamptz,
  status            text,
  visibility        text,
  min_daily_minutes integer,
  max_participants  integer,
  members           integer,
  joined            boolean,
  is_owner          boolean,
  invite_code       text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  return query
  select c.id, c.owner_id, c.name, c.category, c.description, c.start_at, c.end_at,
         public.challenge_status(c.start_at, c.end_at, c.cancelled_at),
         c.visibility, c.min_daily_minutes, c.max_participants,
         (select count(*)::integer from public.challenge_members m
           where m.challenge_id = c.id and m.status = 'active'),
         mine.user_id is not null,
         c.owner_id = v_uid,
         -- The code is a capability: only people already inside get to pass it on.
         case when c.owner_id = v_uid or mine.user_id is not null
              then (select ci.code from public.challenge_invites ci where ci.challenge_id = c.id)
         end
    from public.challenges c
    left join public.challenge_members mine
           on mine.challenge_id = c.id and mine.user_id = v_uid and mine.status = 'active'
   where c.id = p_challenge
     and (c.visibility = 'public' or c.owner_id = v_uid or mine.user_id is not null);
end;
$$;

drop function if exists public.list_challenges();
create function public.list_challenges()
returns table (
  id                uuid,
  owner_id          uuid,
  name              text,
  category          text,
  description       text,
  start_at          timestamptz,
  end_at            timestamptz,
  starts_on         date,
  ends_on           date,
  status            text,
  visibility        text,
  min_daily_minutes integer,
  max_participants  integer,
  members           integer,
  member_count      integer,
  joined            boolean,
  is_owner          boolean,
  day_index         integer,
  total_days        integer,
  my_score          numeric,
  invite_code       text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  return query
  with visible as (
    select c.*,
           mine.user_id is not null as is_member,
           public.challenge_status(c.start_at, c.end_at, c.cancelled_at) as derived_status,
           (select count(*)::integer from public.challenge_members m
             where m.challenge_id = c.id and m.status = 'active') as active_members
      from public.challenges c
      left join public.challenge_members mine
             on mine.challenge_id = c.id and mine.user_id = v_uid and mine.status = 'active'
     where c.owner_id = v_uid
        or mine.user_id is not null
        or (c.visibility = 'public' and c.cancelled_at is null
            and c.end_at > now() - interval '30 days')
  )
  select v.id, v.owner_id, v.name, v.category, v.description, v.start_at, v.end_at,
         -- starts_on/ends_on are aliases kept for the Flutter builds already in
         -- the wild; they read the old names, and keeping 0001's `date` type
         -- means those builds render exactly what they did before.
         v.start_at::date, v.end_at::date,
         v.derived_status, v.visibility, v.min_daily_minutes, v.max_participants,
         v.active_members, v.active_members,
         v.is_member, v.owner_id = v_uid,
         greatest(0, least((v.end_at::date - v.start_at::date) + 1,
                           (current_date - v.start_at::date) + 1))::integer as day_index,
         ((v.end_at::date - v.start_at::date) + 1)::integer as total_days,
         (select coalesce(m.final_score,
                          (select agg.score from public.challenge_scores(v.id, v_uid) agg))
            from public.challenge_members m
           where m.challenge_id = v.id and m.user_id = v_uid) as my_score,
         case when v.owner_id = v_uid or v.is_member
              then (select ci.code from public.challenge_invites ci where ci.challenge_id = v.id)
         end as invite_code
    from visible v
   order by case v.derived_status
              when 'active'    then 0
              when 'upcoming'  then 1
              when 'completed' then 2
              else 3
            end,
            v.is_member desc,
            v.start_at desc,
            v.id;
end;
$$;

/** Membership gate for the two leaderboard reads. */
create or replace function public.challenge_can_read(p_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.visibility = 'public'
      or c.owner_id = auth.uid()
      or exists (select 1 from public.challenge_members m
                  where m.challenge_id = c.id and m.user_id = auth.uid())
    from public.challenges c
   where c.id = p_challenge;
$$;

/**
 * Top five plus your own row, whatever your rank — the shape §6 of the plan
 * asked for. Three fixes over 0005: rank is cast to integer (0005 declared
 * `rank integer` and returned rank()'s bigint, so the call raised 42804 before
 * emitting a single row); the score is live from challenge_scores until
 * finalize_challenges freezes final_score; and members who left are still
 * listed, because filtering them out made leaving a free way to erase a bad run.
 *
 * Name, score and rank are the only columns. No task titles, no categories, no
 * routine — the privacy rule in §3 is enforced by what this function selects.
 */
drop function if exists public.get_challenge_leaderboard(uuid);
create function public.get_challenge_leaderboard(p_challenge uuid)
returns table (
  user_id       uuid,
  name          text,
  score         numeric,
  rank          integer,
  is_me         boolean,
  has_left      boolean,
  is_final      boolean,
  total_members integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ok  boolean;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  v_ok := public.challenge_can_read(p_challenge);
  if v_ok is null then raise exception 'Challenge not found' using errcode = 'P0002'; end if;
  if not v_ok then
    raise exception 'Not authorized to view this challenge' using errcode = '42501';
  end if;

  return query
  with scored as (
    select m.user_id,
           coalesce(m.final_score, agg.score, 0) as score,
           m.status = 'left' as has_left,
           m.final_score is not null as is_final
      from public.challenge_members m
      left join public.challenge_scores(p_challenge) agg on agg.user_id = m.user_id
     where m.challenge_id = p_challenge and m.status in ('active', 'left')
  ),
  ranked as (
    select s.user_id, s.score, s.has_left, s.is_final,
           (rank() over (order by s.score desc))::integer as rnk,
           (count(*) over ())::integer as total
      from scored s
  )
  select r.user_id,
         coalesce(nullif(trim(p.name), ''), 'Anonymous'),
         r.score,
         r.rnk,
         r.user_id = v_uid,
         r.has_left,
         r.is_final,
         r.total
    from ranked r
    join public.profiles p on p.id = r.user_id
   -- Ties share a rank; the secondary keys only decide the print order.
   where r.rnk <= 5 or r.user_id = v_uid
   order by r.rnk, p.name nulls last, r.user_id;
end;
$$;

/**
 * Your own three components, so the UI can say *why* a score is what it is.
 * Scoped to the caller on purpose: handing out a peer's per-component
 * breakdown would leak how they spend their days, which §3 forbids.
 */
create or replace function public.get_challenge_breakdown(p_challenge uuid)
returns table (
  window_days   integer,
  active_days   integer,
  completion    numeric,
  consistency   numeric,
  participation numeric,
  score         numeric,
  is_final      boolean,
  final_rank    integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  return query
  select agg.window_days, agg.active_days, agg.completion, agg.consistency,
         agg.participation, coalesce(m.final_score, agg.score),
         m.final_score is not null, m.final_rank
    from public.challenge_members m
    left join public.challenge_scores(p_challenge, v_uid) agg on agg.user_id = m.user_id
   where m.challenge_id = p_challenge and m.user_id = v_uid;
end;
$$;

/** Kept for src/lib/db.ts's challengeScore(); now with the auth check 0005 omitted. */
create or replace function public.challenge_score(p_user uuid, p_challenge uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_score numeric;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  -- 0005 let any caller name any user. A score is only readable by its owner or
  -- by someone who shares the challenge, and then only via the leaderboard.
  if p_user <> v_uid and not coalesce(public.challenge_can_read(p_challenge), false) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(m.final_score, agg.score)
    into v_score
    from public.challenge_members m
    left join public.challenge_scores(p_challenge, p_user) agg on agg.user_id = m.user_id
   where m.challenge_id = p_challenge and m.user_id = p_user;

  return coalesce(v_score, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Finalization and immutability (§5 of the plan).
--
-- 0005 declared final_score/final_rank and never wrote them, so the leaderboard
-- read `coalesce(final_score, 0)` and every member scored zero forever.
-- ---------------------------------------------------------------------------

create or replace function public.challenge_members_freeze()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.final_score is null then
    return new;   -- Not yet scored: ordinary join/leave updates are fine.
  end if;
  if new.final_score is distinct from old.final_score
     or new.final_rank is distinct from old.final_rank
     -- joined_at defines the scoring window; moving it rewrites a settled result.
     or new.joined_at is distinct from old.joined_at then
    raise exception 'A finalized challenge result cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists challenge_members_freeze_tg on public.challenge_members;
create trigger challenge_members_freeze_tg
  before update on public.challenge_members
  for each row execute function public.challenge_members_freeze();

/**
 * Called by the cron tick. Idempotent by construction: the driving predicate is
 * `finalized_at is null`, the score write is `and final_score is null`, and rows
 * are claimed with `for update skip locked` so two overlapping ticks cannot both
 * score the same challenge. Cancelled challenges get a finalized_at so the scan
 * stays bounded, but no final_score — null reads as "no result" rather than 0.
 */
create or replace function public.finalize_challenges()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ch   record;
  v_m    record;
  v_done integer := 0;
begin
  for v_ch in
    select c.id, c.start_at, c.end_at, c.cancelled_at
      from public.challenges c
     where c.end_at < now() and c.finalized_at is null
     order by c.end_at
     limit 200
     for update skip locked
  loop
    if v_ch.cancelled_at is null then
      -- Freeze the facts before freezing the score: a member who stopped opening
      -- the app mid-challenge has no daily_scores rows for the tail, and those
      -- days must count as zero rather than be missing from the divisor.
      for v_m in
        select cm.user_id from public.challenge_members cm
         where cm.challenge_id = v_ch.id and cm.status in ('active', 'left')
      loop
        perform public.refresh_daily_scores(v_m.user_id,
                                            v_ch.start_at::date, v_ch.end_at::date);
      end loop;

      with final as (
        select agg.user_id,
               coalesce(agg.score, 0) as score,
               (rank() over (order by coalesce(agg.score, 0) desc))::integer as rnk
          from public.challenge_scores(v_ch.id) agg
      )
      update public.challenge_members cm
         set final_score = f.score, final_rank = f.rnk
        from final f
       where cm.challenge_id = v_ch.id
         and cm.user_id = f.user_id
         and cm.final_score is null;
    end if;

    update public.challenges
       set finalized_at = now(), updated_at = now()
     where id = v_ch.id;
    v_done := v_done + 1;
  end loop;

  return v_done;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Pairing RPCs.
--
-- 0005's version inserted straight into `pairings` whenever the address matched
-- a profile — the "fast-pair path". That made consent optional (the plan's §3
-- requires it) and, because the insert named a unique constraint that 0005 had
-- just dropped, it also raised 42P10 on exactly those addresses: a registered
-- email failed, an unregistered one succeeded. A perfect enumeration oracle,
-- inverted. This version only ever writes a request.
-- ---------------------------------------------------------------------------

drop function if exists public.pair_with_email(text);
create function public.pair_with_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_target uuid;
  v_mine   text;
  v_open   integer;
  v_req    uuid;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;

  select lower(pr.email) into v_mine from public.profiles pr where pr.id = v_uid;
  if v_email = v_mine then
    raise exception 'That is your own address' using errcode = '22023';
  end if;

  select count(*)::integer into v_open
    from public.pairing_requests r
   where r.requester_id = v_uid and r.status = 'pending' and r.expires_at > now();
  if v_open >= 20 then
    raise exception 'Too many pending requests — cancel some first' using errcode = '54000';
  end if;

  select p.id into v_target from public.profiles p where lower(p.email) = v_email;

  if v_target is not null and exists (
       select 1 from public.pairings pg
        where pg.user_a = least(v_uid, v_target) and pg.user_b = greatest(v_uid, v_target)) then
    raise exception 'You are already paired with them' using errcode = '23505';
  end if;

  -- One row per (requester, address) while it is pending; re-sending refreshes
  -- the clock instead of stacking up duplicates in the target's inbox.
  insert into public.pairing_requests (requester_id, target_email, target_id, status,
                                       created_at, expires_at)
       values (v_uid, v_email, v_target, 'pending', now(), now() + interval '30 days')
  on conflict (requester_id, target_email) where status = 'pending'
    do update set created_at = now(),
                  expires_at = now() + interval '30 days',
                  target_id  = coalesce(excluded.target_id, pairing_requests.target_id)
    returning id into v_req;

  -- The return value is the same shape whether or not that address has an Ordo
  -- account. Nothing here tells the caller which it was.
  return v_req;
end;
$$;

create or replace function public.respond_to_pairing_request(
  p_request_id uuid,
  p_response   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.pairing_requests;
  v_me  text;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_response not in ('accept', 'decline') then
    raise exception 'Response must be accept or decline' using errcode = '22023';
  end if;

  select * into v_req from public.pairing_requests r where r.id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;

  select lower(p.email) into v_me from public.profiles p where p.id = v_uid;

  -- 0005 compared target_email to the profile email without lowering both sides,
  -- so anyone who signed up as "Sam@x.com" could never answer their own invites.
  if v_req.target_id is distinct from v_uid
     and lower(coalesce(v_req.target_email, '')) is distinct from coalesce(v_me, '') then
    raise exception 'Not authorized to respond' using errcode = '42501';
  end if;

  -- Replay guard: 0005 had none, so a re-POST of an accepted request re-ran the
  -- pairing insert and re-stamped responded_at.
  if v_req.status <> 'pending' then
    raise exception 'That request has already been answered' using errcode = 'P0002';
  end if;
  if v_req.expires_at <= now() then
    raise exception 'That request has expired' using errcode = 'P0002';
  end if;
  if v_req.requester_id = v_uid then
    raise exception 'You cannot accept your own request' using errcode = '22023';
  end if;

  if p_response = 'accept' then
    insert into public.pairings (user_a, user_b)
         values (least(v_req.requester_id, v_uid), greatest(v_req.requester_id, v_uid))
    on conflict (user_a, user_b) do nothing;
  end if;

  update public.pairing_requests
     set status = case when p_response = 'accept' then 'accepted' else 'declined' end,
         responded_at = now(),
         target_id = v_uid
   where id = p_request_id;
end;
$$;

create or replace function public.cancel_pairing_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  delete from public.pairing_requests
   where id = p_request_id and requester_id = v_uid and status = 'pending';
  if not found then
    raise exception 'No pending request to cancel' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.unpair_user(p_peer uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  delete from public.pairings
   where user_a = least(v_uid, p_peer) and user_b = greatest(v_uid, p_peer);

  -- Clear the history in both directions, so re-pairing later starts clean
  -- rather than tripping the "already answered" guard on a stale accepted row.
  delete from public.pairing_requests r
   where (r.requester_id = v_uid and r.target_id = p_peer)
      or (r.requester_id = p_peer and r.target_id = v_uid);
end;
$$;

drop function if exists public.get_accountability_partners();
create function public.get_accountability_partners()
returns table (
  id        uuid,
  name      text,
  email     text,
  weekly    integer,
  paired_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  -- Name, email, one weekly number. Nothing about what the days contained.
  return query
  select p.id, p.name, p.email, public.weekly_pct(p.id), pr.created_at
    from public.pairings pr
    join public.profiles p
      on p.id = case when pr.user_a = v_uid then pr.user_b else pr.user_a end
   where v_uid in (pr.user_a, pr.user_b)
   order by p.name nulls last, p.email;
end;
$$;

/** The pairing inbox, both directions, so a sent request is visible as pending. */
create or replace function public.list_pairing_requests()
returns table (
  id         uuid,
  direction  text,
  peer_id    uuid,
  peer_name  text,
  peer_email text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_me  text;
begin
  if v_uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select lower(p.email) into v_me from public.profiles p where p.id = v_uid;

  return query
  select r.id, 'incoming'::text, r.requester_id, rp.name, rp.email, r.created_at, r.expires_at
    from public.pairing_requests r
    join public.profiles rp on rp.id = r.requester_id
   where r.status = 'pending' and r.expires_at > now()
     and (r.target_id = v_uid or lower(r.target_email) = v_me)
     and r.requester_id <> v_uid
  union all
  select r.id, 'outgoing'::text, tp.id, tp.name, r.target_email, r.created_at, r.expires_at
    from public.pairing_requests r
    left join public.profiles tp on tp.id = r.target_id
   where r.status = 'pending' and r.expires_at > now()
     and r.requester_id = v_uid
   order by 6 desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Legacy shims.
--
-- 0005 dropped three functions that shipped Flutter builds still call
-- (mobile/lib/services/db.dart:31, :49, :61). Those builds cannot be recalled,
-- and each call site swallows its error into an empty list, so the screen just
-- goes quiet. Restoring the old names against the new implementation keeps them
-- working; the app store update in task #3 moves them to the new surface.
-- ---------------------------------------------------------------------------

create or replace function public.unpair(p_peer uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.unpair_user(p_peer);
$$;

/** 0001's shape: a name and a length in days, 7–90. */
create or replace function public.create_challenge(p_name text, p_days integer)
returns public.challenges
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.challenges;
begin
  v_row := public.create_challenge(
    p_name,
    'general'::text,
    ''::text,
    now(),
    now() + (greatest(7, least(90, coalesce(p_days, 30))) || ' days')::interval,
    'public'::text,
    null::integer,
    null::integer
  );
  return v_row;
end;
$$;

/** 0001's shape: score as an integer, ranked rows only. */
create or replace function public.challenge_leaderboard(p_challenge uuid)
returns table (user_id uuid, name text, score integer, rank integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lb.user_id, lb.name, round(lb.score)::integer, lb.rank
    from public.get_challenge_leaderboard(p_challenge) lb
   order by lb.rank, lb.name;
$$;

-- ---------------------------------------------------------------------------
-- 12. Row level security.
--
-- 0005 added pairing_requests and challenge_daily_stats with no RLS and no
-- grants, and its `drop table challenge_members cascade` took 0001's policy and
-- privileges with it. 0001's blanket revoke ran before any of those tables
-- existed, so on the live project they sit on whatever Supabase's default
-- privileges happen to be. Both halves are restated here explicitly.
-- ---------------------------------------------------------------------------

alter table public.pairing_requests   enable row level security;
alter table public.challenge_members  enable row level security;
alter table public.challenge_invites  enable row level security;
alter table public.daily_scores       enable row level security;

do $$
begin
  if to_regclass('public.challenge_daily_stats') is not null then
    execute 'alter table public.challenge_daily_stats enable row level security';
  end if;
end
$$;

-- pairing_requests, challenge_invites and daily_scores get no policies at all.
-- With RLS on and no policy, the only way in is a SECURITY DEFINER function,
-- which is the whole access model for them: an inbox that must not be readable
-- by the requester's target list, invite codes that are capabilities, and a
-- facts table derived from a document the owner already has.

-- Membership rows: read your own (final_score/final_rank live here). Writes go
-- through join/leave, and the delete privilege 0001 granted is not restored —
-- deleting a row after finalize_challenges would erase a settled result.
drop policy if exists "challenge_members: own row"  on public.challenge_members;
drop policy if exists "challenge_members: read own" on public.challenge_members;
create policy "challenge_members: read own" on public.challenge_members
  for select to authenticated using (user_id = auth.uid());

-- 0001 let any authenticated user select every challenge row. That was tolerable
-- when a challenge was a name and two dates; 0005 added description, and a
-- private challenge whose title is readable by everyone is not private.
drop policy if exists "challenges: read all" on public.challenges;
drop policy if exists "challenges: read visible" on public.challenges;
create policy "challenges: read visible" on public.challenges
  for select to authenticated using (
    visibility = 'public'
    or owner_id = auth.uid()
    or exists (
      select 1 from public.challenge_members m
       -- Qualified on purpose: challenge_members has its own `id`, so a bare
       -- `id` here would silently resolve to it and match nothing.
       where m.challenge_id = public.challenges.id and m.user_id = auth.uid()
    )
  );

-- Deleting a challenge cascades to every member's frozen result. cancel_challenge
-- is the supported way out; it keeps the history and scores nobody.
drop policy if exists "challenges: delete own" on public.challenges;
revoke delete on public.challenges from authenticated;

revoke all on public.pairing_requests    from anon, authenticated;
revoke all on public.challenge_invites   from anon, authenticated;
revoke all on public.daily_scores        from anon, authenticated;
revoke all on public.challenge_members   from anon, authenticated;
grant select on public.challenge_members to authenticated;
grant all on public.pairing_requests, public.challenge_invites,
             public.daily_scores, public.challenge_members to service_role;

do $$
begin
  if to_regclass('public.challenge_daily_stats') is not null then
    execute 'revoke all on public.challenge_daily_stats from anon, authenticated';
    execute 'grant all on public.challenge_daily_stats to service_role';
  end if;
end
$$;

-- Fail the migration rather than ship a readable table. Every table in this
-- schema is meant to be RLS-protected; 0003 held that line, 0005 did not.
do $$
declare
  v_bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_bad
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if v_bad is not null then
    raise exception 'Tables in public without row level security: %', v_bad;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 13. Function privileges.
--
-- Postgres grants EXECUTE to PUBLIC on every new function, so the revokes are
-- what actually close the internal helpers. challenge_join_internal is the one
-- that matters most: it takes a boolean that waives the invite-code check, and
-- PostgREST will happily pass a named argument to any function a client may run.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.pair_with_email(text),
  public.respond_to_pairing_request(uuid, text),
  public.cancel_pairing_request(uuid),
  public.unpair_user(uuid),
  public.unpair(uuid),
  public.get_accountability_partners(),
  public.list_pairing_requests(),
  public.create_challenge(text, text, text, timestamptz, timestamptz, text, integer, integer),
  public.create_challenge(text, integer),
  public.join_challenge(uuid),
  public.join_challenge_by_code(text),
  public.leave_challenge(uuid),
  public.cancel_challenge(uuid),
  public.get_challenge(uuid),
  public.list_challenges(),
  public.get_challenge_leaderboard(uuid),
  public.challenge_leaderboard(uuid),
  public.get_challenge_breakdown(uuid),
  public.challenge_score(uuid, uuid),
  public.challenge_status(timestamptz, timestamptz, timestamptz),
  public.weekly_pct(uuid)
from public, anon, authenticated;

grant execute on function
  public.pair_with_email(text),
  public.respond_to_pairing_request(uuid, text),
  public.cancel_pairing_request(uuid),
  public.unpair_user(uuid),
  public.unpair(uuid),
  public.get_accountability_partners(),
  public.list_pairing_requests(),
  public.create_challenge(text, text, text, timestamptz, timestamptz, text, integer, integer),
  public.create_challenge(text, integer),
  public.join_challenge(uuid),
  public.join_challenge_by_code(text),
  public.leave_challenge(uuid),
  public.cancel_challenge(uuid),
  public.get_challenge(uuid),
  public.list_challenges(),
  public.get_challenge_leaderboard(uuid),
  public.challenge_leaderboard(uuid),
  public.get_challenge_breakdown(uuid),
  public.challenge_score(uuid, uuid),
  public.challenge_status(timestamptz, timestamptz, timestamptz),
  public.weekly_pct(uuid)
to authenticated;

-- Internal. Reachable only from the definer functions above, or from the cron
-- client's service-role key.
revoke execute on function
  public.challenge_join_internal(uuid, boolean),
  public.challenge_can_read(uuid),
  public.challenge_scores(uuid, uuid),
  public.completion_pct(uuid, timestamptz, timestamptz),
  public.finalize_challenges(),
  public.refresh_daily_scores(uuid, date[]),
  public.refresh_daily_scores(uuid, date, date),
  public.changed_date_keys(jsonb, jsonb),
  public.day_facts(jsonb, date),
  public.block_minutes(text, text),
  public.challenge_members_freeze()
from public, anon, authenticated;

grant execute on function
  public.challenge_scores(uuid, uuid),
  public.completion_pct(uuid, timestamptz, timestamptz),
  public.finalize_challenges(),
  public.refresh_daily_scores(uuid, date[]),
  public.refresh_daily_scores(uuid, date, date)
to service_role;














