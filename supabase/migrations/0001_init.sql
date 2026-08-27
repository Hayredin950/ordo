-- Ordo — Supabase schema. The database IS the backend: every table is guarded by
-- row level security, and anything that must read across users goes through a
-- SECURITY DEFINER function that returns aggregates only, never raw state.
--
-- Identity comes from Supabase Auth (auth.users). The old hand-rolled `users`
-- and `sessions` tables are gone; `profiles` mirrors the public bits.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles — mirror of auth.users, kept in sync by trigger.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null default '',
  name       text not null default '',
  avatar_url text not null default '',
  provider   text not null default 'email',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url, provider)
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
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do update
    set email      = excluded.email,
        name       = case when profiles.name = '' then excluded.name else profiles.name end,
        avatar_url = case when profiles.avatar_url = '' then excluded.avatar_url else profiles.avatar_url end,
        provider   = excluded.provider;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- The user's whole Ordo document, plus the undo history stack.
-- ---------------------------------------------------------------------------
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  history    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notification channels.
-- ---------------------------------------------------------------------------
create table if not exists public.telegram_links (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  chat_id   bigint not null,
  username  text not null default '',
  linked_at timestamptz not null default now()
);
create unique index if not exists telegram_links_chat_idx on public.telegram_links (chat_id);

create table if not exists public.slack_links (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  channel   text not null,
  linked_at timestamptz not null default now()
);

-- One-shot codes that bind a Telegram chat to a web account.
create table if not exists public.telegram_codes (
  code       text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists telegram_codes_user_idx on public.telegram_codes (user_id);

create table if not exists public.notification_rules (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type    text not null,
  channel text not null default 'telegram',
  time    text not null default '',
  enabled boolean not null default true
);
create index if not exists notification_rules_user_idx on public.notification_rules (user_id);
-- ---------------------------------------------------------------------------
-- Community: shared templates, pairings, challenges, future letters.
-- ---------------------------------------------------------------------------
create table if not exists public.public_templates (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  name        text not null,
  blocks      jsonb not null,
  copies      integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists public_templates_created_idx on public.public_templates (created_at desc);

-- Two paired users see each other's weekly %, never task details.
create table if not exists public.pairings (
  user_a     uuid not null references auth.users (id) on delete cascade,
  user_b     uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists pairings_user_b_idx on public.pairings (user_b);

create table if not exists public.challenges (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  starts_on  date not null default current_date,
  ends_on    date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index if not exists challenge_members_user_idx on public.challenge_members (user_id);

create table if not exists public.future_letters (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  goal_title text not null,
  body       text not null,
  deadline   date not null,
  delivered  boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists future_letters_due_idx on public.future_letters (deadline) where not delivered;
create table if not exists public.onboarding (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  goal_set        boolean not null default false,
  routine_set     boolean not null default false,
  telegram_linked boolean not null default false,
  completed_at    timestamptz
);

-- Cron idempotency. Three schedulers point at /api/cron/tick (GitHub Actions
-- every 5 min, Vercel once a day, plus any external pinger), so every outbound
-- notification is claimed here first — the primary key makes the claim atomic.
create table if not exists public.notification_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind    text not null,
  day     date not null default current_date,
  ref     text not null default '',
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, day, ref)
);
create index if not exists notification_log_sent_idx on public.notification_log (sent_at);

-- ---------------------------------------------------------------------------
-- Row level security. Default posture: a row belongs to exactly one user and
-- only that user may touch it. Nothing below grants cross-user reads.
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.user_state         enable row level security;
alter table public.telegram_links     enable row level security;
alter table public.slack_links        enable row level security;
alter table public.telegram_codes     enable row level security;
alter table public.notification_rules enable row level security;
alter table public.public_templates   enable row level security;
alter table public.pairings           enable row level security;
alter table public.challenges         enable row level security;
alter table public.challenge_members  enable row level security;
alter table public.future_letters     enable row level security;
alter table public.onboarding         enable row level security;
alter table public.notification_log   enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "user_state: own row" on public.user_state
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "telegram_links: own row" on public.telegram_links
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "slack_links: own row" on public.slack_links
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "telegram_codes: own row" on public.telegram_codes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notification_rules: own row" on public.notification_rules
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The shared library is the one intentionally public list. Rows carry only a
-- display name and a block array the author chose to publish.
create policy "public_templates: read all" on public.public_templates
  for select to authenticated using (true);
create policy "public_templates: insert own" on public.public_templates
  for insert to authenticated with check (author_id = auth.uid());
create policy "public_templates: delete own" on public.public_templates
  for delete to authenticated using (author_id = auth.uid());

-- Pairings are readable/removable by either side; creating one needs an email
-- lookup, so it goes through pair_with_email().
create policy "pairings: read own" on public.pairings
  for select to authenticated using (auth.uid() in (user_a, user_b));
create policy "pairings: delete own" on public.pairings
  for delete to authenticated using (auth.uid() in (user_a, user_b));

create policy "challenges: read all" on public.challenges
  for select to authenticated using (true);
create policy "challenges: insert own" on public.challenges
  for insert to authenticated with check (owner_id = auth.uid());
create policy "challenges: delete own" on public.challenges
  for delete to authenticated using (owner_id = auth.uid());

-- Membership rows stay private; counts and leaderboards come from functions.
create policy "challenge_members: own row" on public.challenge_members
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "future_letters: own row" on public.future_letters
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "onboarding: own row" on public.onboarding
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notification_log deliberately has no policies: only the service-role cron
-- client, which bypasses RLS, ever touches it.

-- ---------------------------------------------------------------------------
-- Scoring, in SQL, so peer/leaderboard numbers can be computed without ever
-- handing another user's document to the client. Mirrors dayScore/rangeScore
-- in src/lib/ordo.ts: mean over the last 7 days of (sum of block % / blocks).
-- ---------------------------------------------------------------------------
create or replace function public.weekly_pct(p_user uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_state   jsonb;
  v_blocks  jsonb;
  v_entries jsonb;
  v_sum     numeric := 0;
  v_daysum  numeric;
  v_count   integer;
  v_days    integer := 0;
  v_day     date;
  i         integer;
begin
  select state into v_state from public.user_state where user_id = p_user;
  if v_state is null or v_state -> 'routine' is null then
    return null;
  end if;

  for i in 0..6 loop
    v_day := current_date - i;
    v_blocks := coalesce(
      v_state -> 'routine' -> (extract(dow from v_day)::integer::text),
      '[]'::jsonb
    );
    v_count := jsonb_array_length(v_blocks);
    continue when v_count = 0;

    v_entries := coalesce(v_state -> 'log' -> to_char(v_day, 'YYYY-MM-DD'), '{}'::jsonb);
    select coalesce(sum(coalesce((v_entries ->> (b ->> 'id'))::numeric, 0)), 0)
      into v_daysum
      from jsonb_array_elements(v_blocks) as b;

    v_sum  := v_sum + v_daysum / v_count;
    v_days := v_days + 1;
  end loop;

  if v_days = 0 then
    return null;
  end if;
  return round(v_sum / v_days);
exception
  when others then
    -- A malformed document must not break a whole leaderboard.
    return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_state — the write path for the client. Pushes the previous document onto
-- the history stack (capped at 30) so undo_state() has something to pop.
-- ---------------------------------------------------------------------------
create or replace function public.save_state(p_state jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_prev jsonb;
  v_hist jsonb;
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
    insert into public.user_state (user_id, state, history)
      values (v_uid, p_state, '[]'::jsonb);
    return;
  end if;

  if v_prev = p_state then
    update public.user_state set updated_at = now() where user_id = v_uid;
    return;
  end if;

  -- Append the outgoing document, then trim from the front. The original
  -- Express version applied `- 0` unconditionally, so history never grew
  -- past a single entry; the loop below is what actually keeps 30.
  v_hist := coalesce(v_hist, '[]'::jsonb) || jsonb_build_array(v_prev);
  while jsonb_array_length(v_hist) > 30 loop
    v_hist := v_hist - 0;
  end loop;

  update public.user_state
     set state = p_state, history = v_hist, updated_at = now()
   where user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- undo_state — pop the newest history entry back into place.
-- ---------------------------------------------------------------------------
create or replace function public.undo_state()
returns jsonb
language plpgsql
security definer
set search_path = public
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
     set state = v_prev, history = v_hist - (v_len - 1), updated_at = now()
   where user_id = v_uid;

  return v_prev;
end;
$$;

-- ---------------------------------------------------------------------------
-- peer_progress — paired users, with a weekly % and nothing else.
-- ---------------------------------------------------------------------------
create or replace function public.peer_progress()
returns table (id uuid, name text, email text, weekly integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.name,
         p.email,
         public.weekly_pct(p.id)
    from public.pairings pr
    join public.profiles p
      on p.id = case when pr.user_a = auth.uid() then pr.user_b else pr.user_a end
   where auth.uid() in (pr.user_a, pr.user_b)
   order by p.name, p.email;
$$;

-- ---------------------------------------------------------------------------
-- pair_with_email — the only way to create a pairing. Resolves the email
-- server-side so the client never gets to enumerate accounts.
-- ---------------------------------------------------------------------------
create or replace function public.pair_with_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_peer  uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if v_email = '' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;

  select id into v_peer from public.profiles where lower(email) = v_email;
  if v_peer is null then
    raise exception 'No account with that email — invite them to Ordo first'
      using errcode = 'P0002';
  end if;
  if v_peer = v_uid then
    raise exception 'You can''t pair with yourself' using errcode = '22023';
  end if;

  insert into public.pairings (user_a, user_b)
  values (least(v_uid, v_peer), greatest(v_uid, v_peer))
  on conflict do nothing;
end;
$$;

create or replace function public.unpair(p_peer uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.pairings
   where auth.uid() is not null
     and user_a = least(auth.uid(), p_peer)
     and user_b = greatest(auth.uid(), p_peer);
$$;

-- ---------------------------------------------------------------------------
-- Challenges. Membership rows are private, so the list, the join and the
-- leaderboard all run as definer and return only counts, names and scores.
-- ---------------------------------------------------------------------------
create or replace function public.list_challenges()
returns table (
  id uuid, name text, starts_on date, ends_on date,
  owner_id uuid, members integer, joined boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         c.name,
         c.starts_on,
         c.ends_on,
         c.owner_id,
         (select count(*)::integer from public.challenge_members m where m.challenge_id = c.id),
         exists (
           select 1 from public.challenge_members me
            where me.challenge_id = c.id and me.user_id = auth.uid()
         )
    from public.challenges c
   where auth.uid() is not null
   order by c.created_at desc
   limit 50;
$$;

create or replace function public.create_challenge(p_name text, p_days integer)
returns public.challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.challenges;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 80 then
    raise exception 'Invalid challenge name' using errcode = '22023';
  end if;
  if p_days is null or p_days < 7 or p_days > 90 then
    raise exception 'Challenge length must be 7-90 days' using errcode = '22023';
  end if;

  insert into public.challenges (owner_id, name, starts_on, ends_on)
  values (v_uid, trim(p_name), current_date, current_date + p_days)
  returning * into v_row;

  insert into public.challenge_members (challenge_id, user_id)
  values (v_row.id, v_uid)
  on conflict do nothing;

  return v_row;
end;
$$;
create or replace function public.join_challenge(p_challenge uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.challenges c where c.id = p_challenge) then
    raise exception 'Challenge not found' using errcode = 'P0002';
  end if;

  insert into public.challenge_members (challenge_id, user_id)
  values (p_challenge, v_uid)
  on conflict do nothing;
end;
$$;

create or replace function public.challenge_leaderboard(p_challenge uuid)
returns table (user_id uuid, name text, score integer)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id,
         coalesce(nullif(p.name, ''), split_part(p.email, '@', 1)),
         coalesce(public.weekly_pct(m.user_id), 0)
    from public.challenge_members m
    join public.profiles p on p.id = m.user_id
   where m.challenge_id = p_challenge
     and auth.uid() is not null
   order by 3 desc, 2 asc;
$$;

-- ---------------------------------------------------------------------------
-- Shared template library. Publishing stamps the author's display name;
-- copying bumps a counter on a row the copier cannot otherwise write.
-- ---------------------------------------------------------------------------
create or replace function public.publish_template(p_name text, p_blocks jsonb)
returns public.public_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_prof public.profiles;
  v_row  public.public_templates;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 80 then
    raise exception 'Invalid template name' using errcode = '22023';
  end if;
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array'
     or jsonb_array_length(p_blocks) < 1 or jsonb_array_length(p_blocks) > 40 then
    raise exception 'A template needs 1-40 blocks' using errcode = '22023';
  end if;

  select * into v_prof from public.profiles where id = v_uid;

  insert into public.public_templates (author_id, author_name, name, blocks)
  values (
    v_uid,
    coalesce(nullif(v_prof.name, ''), split_part(coalesce(v_prof.email, ''), '@', 1)),
    trim(p_name),
    p_blocks
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.copy_public_template(p_id uuid)
returns table (name text, blocks jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  update public.public_templates t
     set copies = t.copies + 1
   where t.id = p_id
  returning t.name, t.blocks into name, blocks;

  if not found then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;
  return next;
end;
$$;
-- ---------------------------------------------------------------------------
-- Onboarding checklist. Flags only ever move false -> true.
-- ---------------------------------------------------------------------------
create or replace function public.set_onboarding(
  p_goal_set boolean default null,
  p_routine_set boolean default null,
  p_telegram_linked boolean default null
)
returns public.onboarding
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.onboarding;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.onboarding (user_id, goal_set, routine_set, telegram_linked)
  values (v_uid, coalesce(p_goal_set, false), coalesce(p_routine_set, false),
          coalesce(p_telegram_linked, false))
  on conflict (user_id) do update
    set goal_set        = onboarding.goal_set        or coalesce(p_goal_set, false),
        routine_set     = onboarding.routine_set     or coalesce(p_routine_set, false),
        telegram_linked = onboarding.telegram_linked or coalesce(p_telegram_linked, false)
  returning * into v_row;

  if v_row.goal_set and v_row.routine_set and v_row.telegram_linked
     and v_row.completed_at is null then
    update public.onboarding set completed_at = now()
     where user_id = v_uid
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Telegram linking. The client mints a code; the webhook (service role)
-- redeems it. Codes are single use and expire in 15 minutes.
-- ---------------------------------------------------------------------------
create or replace function public.create_telegram_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  delete from public.telegram_codes where user_id = v_uid or expires_at < now();

  v_code := upper(encode(gen_random_bytes(4), 'hex'));
  insert into public.telegram_codes (code, user_id, expires_at)
  values (v_code, v_uid, now() + interval '15 minutes')
  on conflict (code) do update
    set user_id = excluded.user_id, expires_at = excluded.expires_at;

  return v_code;
end;
$$;

-- Redeemed by /api/telegram/webhook with the service-role key.
create or replace function public.claim_telegram_code(
  p_code text,
  p_chat_id bigint,
  p_username text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  delete from public.telegram_codes
   where code = upper(trim(coalesce(p_code, ''))) and expires_at > now()
  returning user_id into v_uid;

  if v_uid is null then
    return null;
  end if;

  delete from public.telegram_links where chat_id = p_chat_id and user_id <> v_uid;

  insert into public.telegram_links (user_id, chat_id, username)
  values (v_uid, p_chat_id, coalesce(p_username, ''))
  on conflict (user_id) do update
    set chat_id = excluded.chat_id,
        username = excluded.username,
        linked_at = now();

  -- Tick the checklist directly: auth.uid() is null on the service-role path,
  -- so set_onboarding() is not usable from here.
  insert into public.onboarding (user_id, telegram_linked)
  values (v_uid, true)
  on conflict (user_id) do update set telegram_linked = true;

  update public.onboarding
     set completed_at = now()
   where user_id = v_uid and goal_set and routine_set and telegram_linked
     and completed_at is null;

  return v_uid;
end;
$$;
-- ---------------------------------------------------------------------------
-- Account deletion. Removing the auth.users row cascades through every table
-- above, so this is the whole GDPR story in one statement.
-- ---------------------------------------------------------------------------
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. SECURITY DEFINER functions are executable by PUBLIC by default, so
-- every one is locked down and re-granted to exactly the role that needs it.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.weekly_pct(uuid),
  public.save_state(jsonb),
  public.undo_state(),
  public.peer_progress(),
  public.pair_with_email(text),
  public.unpair(uuid),
  public.list_challenges(),
  public.create_challenge(text, integer),
  public.join_challenge(uuid),
  public.challenge_leaderboard(uuid),
  public.publish_template(text, jsonb),
  public.copy_public_template(uuid),
  public.set_onboarding(boolean, boolean, boolean),
  public.create_telegram_code(),
  public.claim_telegram_code(text, bigint, text),
  public.delete_account()
from public, anon, authenticated;

grant execute on function
  public.save_state(jsonb),
  public.undo_state(),
  public.peer_progress(),
  public.pair_with_email(text),
  public.unpair(uuid),
  public.list_challenges(),
  public.create_challenge(text, integer),
  public.join_challenge(uuid),
  public.challenge_leaderboard(uuid),
  public.publish_template(text, jsonb),
  public.copy_public_template(uuid),
  public.set_onboarding(boolean, boolean, boolean),
  public.create_telegram_code(),
  public.delete_account()
to authenticated;

-- weekly_pct is an internal helper (it reads another user's document); only the
-- definer functions above and the cron service role may call it.
grant execute on function
  public.weekly_pct(uuid),
  public.claim_telegram_code(text, bigint, text)
to service_role;

-- Table privileges, stated explicitly rather than inherited from Supabase's
-- default privileges. RLS decides *which* rows; these decide which verbs even
-- reach the policies. Everything a client writes indirectly (documents,
-- pairings, published templates, challenge membership) is insert/update-free
-- here and goes through the functions above instead.
revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;

grant select, update             on public.profiles           to authenticated;
grant select                    on public.user_state          to authenticated;
grant select, delete             on public.telegram_links     to authenticated;
grant select, insert, update, delete on public.slack_links    to authenticated;
grant select, delete             on public.telegram_codes     to authenticated;
grant select, insert, update, delete on public.notification_rules to authenticated;
grant select, delete             on public.public_templates   to authenticated;
grant select, delete             on public.pairings           to authenticated;
grant select, delete             on public.challenges         to authenticated;
grant select, delete             on public.challenge_members  to authenticated;
grant select, insert, delete     on public.future_letters     to authenticated;
grant select                     on public.onboarding         to authenticated;

-- The cron / webhook client uses the service-role key and bypasses RLS.
grant all on all tables in schema public to service_role;

