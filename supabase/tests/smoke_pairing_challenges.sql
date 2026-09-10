-- Ordo — RPC smoke test for pairing and challenges.
--
-- Every defect in 0005 applied cleanly and then raised on the first call, because
-- plpgsql bodies are not validated at CREATE time and both clients swallow the
-- error into an empty state. Applying a migration therefore proves nothing; this
-- file is the proof. It asserts, so it fails loudly.
--
-- Run it against a scratch cluster, never a project with real rows:
--
--   initdb -D /tmp/ordo/data -U ordo --auth=trust
--   pg_ctl -D /tmp/ordo/data -o "-k /tmp/ordo -p 5599 -c listen_addresses=''" start
--   psql -h /tmp/ordo -p 5599 -U ordo -d postgres -f supabase/tests/harness.sql
--   psql ... -f supabase/migrations/0001_init.sql          (then 0003, 0004, 0005, 0006)
--   psql ... -v ON_ERROR_STOP=1 -f supabase/tests/smoke_pairing_challenges.sql
--
-- harness.sql stubs the parts of Supabase that are not in the migrations:
-- auth.users, auth.uid() reading a session GUC, and the three roles.

\set ON_ERROR_STOP on
\set QUIET on
\timing off

\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'
\set C '33333333-3333-3333-3333-333333333333'

-- Carol's address is deliberately mixed case: 0005 compared target_email to
-- profiles.email without lowering both sides, so she could never answer an invite.
insert into auth.users (id, email) values
  (:'A', 'alice@example.com'),
  (:'B', 'bob@example.com'),
  (:'C', 'Carol@Example.com')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Documents. Alice logs two 60-minute blocks a day for ten days; Bob plans the
-- same routine and completes none of it. 0005 scored consistency off
-- planned_minutes, so Bob was a model of discipline.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.routine() returns jsonb language sql as $$
  select jsonb_object_agg(d::text, jsonb_build_array(
    jsonb_build_object('id','b1','title','Study','start','09:00','end','10:00',
                       'category','study','priority','must'),
    jsonb_build_object('id','b2','title','Gym','start','14:00','end','15:00',
                       'category','health','priority','nice')))
    from generate_series(0,6) d;
$$;

create or replace function pg_temp.doc(p_pct integer) returns jsonb language sql as $$
  select jsonb_build_object(
    'routine', pg_temp.routine(),
    'overrides', '{}'::jsonb,
    'log', (select jsonb_object_agg(to_char(current_date - g, 'YYYY-MM-DD'),
                                    jsonb_build_object('b1', p_pct, 'b2', p_pct))
              from generate_series(0,9) g),
    'goals', '[]'::jsonb, 'journal', '{}'::jsonb, 'settings', '{}'::jsonb);
$$;

set app.uid = '11111111-1111-1111-1111-111111111111';
do $x$ begin perform public.save_state(pg_temp.doc(100)); end $x$;
set app.uid = '22222222-2222-2222-2222-222222222222';
do $x$ begin perform public.save_state(pg_temp.doc(0)); end $x$;
do $$
begin
  assert (select count(*) from public.daily_scores
           where user_id = '11111111-1111-1111-1111-111111111111'
             and date > current_date - 10 and completed_minutes = 120) = 10,
    'save_state must write ten days of facts for Alice';
  assert public.weekly_pct('11111111-1111-1111-1111-111111111111') = 100,
    'a fully logged week is 100%';
  assert public.weekly_pct('22222222-2222-2222-2222-222222222222') = 0,
    'planning without doing is 0%, not null';
end
$$;

-- ---------------------------------------------------------------------------
-- Pairing. 0005 wrote a `pairings` row as soon as the address matched a profile
-- (consent optional) and named a unique constraint it had itself dropped, so
-- registered addresses raised 42P10 and unregistered ones succeeded: an
-- enumeration oracle, inverted.
-- ---------------------------------------------------------------------------
set app.uid = '11111111-1111-1111-1111-111111111111';
do $x$ begin perform public.pair_with_email('bob@example.com'); end $x$;
do $x$ begin perform public.pair_with_email('ghost@example.com'); end $x$;
do $x$ begin perform public.pair_with_email('CAROL@example.com'); end $x$;
-- Re-sending must refresh the pending row, not stack a second invite.
do $x$ begin perform public.pair_with_email('bob@example.com'); end $x$;

do $$
begin
  assert (select count(*) from public.pairings) = 0,
    'a request must not create a pairing — the target has not consented yet';
  assert (select count(*) from public.pairing_requests
           where requester_id = '11111111-1111-1111-1111-111111111111') = 3,
    'resending refreshes the pending row instead of stacking duplicates';
  assert (select count(*) from public.pairing_requests
           where target_email = 'carol@example.com') = 1,
    'addresses are stored lowercased';
end
$$;

do $$
declare v_err text;
begin
  -- Registered and unregistered addresses must be indistinguishable from here.
  begin perform public.pair_with_email('alice@example.com');
  exception when others then v_err := sqlerrm; end;
  assert v_err is not null, 'pairing with yourself must be refused';

  v_err := null;
  begin perform public.pair_with_email('not-an-email');
  exception when others then v_err := sqlerrm; end;
  assert v_err is not null, 'a malformed address must be refused';
end
$$;

set app.uid = '22222222-2222-2222-2222-222222222222';
do $$
declare v_req uuid;
begin
  assert (select count(*) from public.list_pairing_requests()
           where direction = 'incoming') = 1, 'Bob has one invite';

  select r.id into v_req from public.pairing_requests r
   where r.requester_id = '11111111-1111-1111-1111-111111111111'
     and r.target_email = 'bob@example.com';
  perform public.respond_to_pairing_request(v_req, 'accept');
  assert (select count(*) from public.pairings) = 1, 'accepting pairs the two';

  -- 0005 had no status guard, so a replayed accept re-ran the insert.
  begin
    perform public.respond_to_pairing_request(v_req, 'accept');
    assert false, 'a second response must be refused';
  exception when others then null;
  end;

  -- Nor may a third party answer someone else's invite.
  begin
    perform public.respond_to_pairing_request(
      (select r.id from public.pairing_requests r where r.target_email = 'ghost@example.com'),
      'accept');
    assert false, 'only the target may respond';
  exception when others then null;
  end;
end
$$;

set app.uid = '33333333-3333-3333-3333-333333333333';
do $$
begin
  perform public.respond_to_pairing_request(
    (select r.id from public.pairing_requests r where r.target_email = 'carol@example.com'),
    'accept');
  assert (select count(*) from public.pairings) = 2,
    'a mixed-case signup address must still match its own invite';
end
$$;

set app.uid = '11111111-1111-1111-1111-111111111111';
do $$
begin
  assert (select count(*) from public.get_accountability_partners()) = 2,
    'Alice has two partners';
  -- The privacy rule from §3, pinned to the shape of the result: if a later
  -- change hands a partner anything about how the days were spent, this fails.
  assert pg_get_function_result('public.get_accountability_partners'::regproc) =
    'TABLE(id uuid, name text, email text, weekly integer, paired_at timestamp with time zone)',
    'a partner row is a name, an address, one percentage and a date';
  perform public.unpair_user('33333333-3333-3333-3333-333333333333');
  assert (select count(*) from public.get_accountability_partners()) = 1,
    'unpairing removes the partner';
  assert (select count(*) from public.pairing_requests
           where target_email = 'carol@example.com') = 0,
    'unpairing clears the history, so re-pairing later is not blocked as a replay';
end
$$;

-- ---------------------------------------------------------------------------
-- Challenges. 0005 created them 'upcoming' and let nothing promote them, while
-- join_challenge required 'active' — so no challenge was ever joinable. Status
-- is now derived from the dates and cannot go stale.
-- ---------------------------------------------------------------------------
set app.uid = '11111111-1111-1111-1111-111111111111';
do $x$ begin perform public.create_challenge('30 days of study', 'study', 'Steady work',
                               now(), now() + interval '30 days', 'public', null, 30); end $x$;
do $x$ begin perform public.create_challenge('Secret sprint', 'work', '',
                               now(), now() + interval '14 days', 'private', 5, 45); end $x$;
do $x$ begin perform public.create_challenge('Long over', 'work', '',
                               now() - interval '40 days', now() - interval '10 days',
                               'public', null, 30); end $x$;
do $$
declare v_id uuid;
begin
  select c.id into v_id from public.challenges c where c.name = '30 days of study';
  assert (select ch.status from public.get_challenge(v_id) ch) = 'active',
    'a challenge that started today is active, not upcoming';
  assert (select ch.status from public.get_challenge(
            (select c.id from public.challenges c where c.name = 'Long over')) ch) = 'completed',
    'a challenge past its end date reads as completed';
  assert (select count(*) from public.list_challenges()) = 3, 'Alice sees all three';

  -- Invite codes moved off the challenges row: 0005 kept invite_code on a table
  -- that `challenges: read all` exposed to every authenticated user.
  assert (select ch.invite_code from public.get_challenge(
            (select c.id from public.challenges c where c.name = 'Secret sprint')) ch) is not null,
    'the owner of a private challenge can read its code';
  assert not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'challenges'
                        and column_name = 'invite_code'),
    'the code must not live on a row that authenticated clients can select';
end
$$;

set app.uid = '22222222-2222-2222-2222-222222222222';
do $$
declare
  v_pub  uuid;
  v_priv uuid;
  v_code text;
begin
  select c.id into v_pub  from public.challenges c where c.name = '30 days of study';
  select c.id into v_priv from public.challenges c where c.name = 'Secret sprint';

  assert (select count(*) from public.get_challenge(v_priv)) = 0,
    'a private challenge is invisible to a non-member';
  begin
    perform public.join_challenge(v_priv);
    assert false, 'a private challenge cannot be joined without a code';
  exception when others then null;
  end;

  select ci.code into v_code from public.challenge_invites ci where ci.challenge_id = v_priv;
  perform public.join_challenge_by_code(lower(v_code));   -- case and padding tolerant
  assert (select count(*) from public.get_challenge(v_priv)) = 1,
    'joining by code makes the challenge visible';

  perform public.join_challenge(v_pub);
  begin
    perform public.join_challenge(v_pub);
    assert false, 'joining twice must be refused';
  exception when others then null;
  end;

  begin
    perform public.join_challenge(
      (select c.id from public.challenges c where c.name = 'Long over'));
    assert false, 'a finished challenge cannot be joined';
  exception when others then null;
  end;
end
$$;

-- The join cutoff: a fifth of the way in, the door closes. Without it a fresh
-- five-day window has enough variance to outrank a month of steady work.
set app.uid = '11111111-1111-1111-1111-111111111111';
do $x$ begin perform public.create_challenge('Late arrival', 'work', '',
                               now() - interval '8 days', now() + interval '2 days',
                               'public', null, 30); end $x$;
set app.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  begin
    perform public.join_challenge(
      (select c.id from public.challenges c where c.name = 'Late arrival'));
    assert false, 'joining after the cutoff must be refused';
  exception when others then null;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- Scoring and the leaderboard. 0005 declared `rank integer` and returned
-- rank()'s bigint, so the call raised 42804 before emitting a row; and it read
-- coalesce(final_score, 0) against a column nothing ever wrote, so every member
-- scored zero forever.
-- ---------------------------------------------------------------------------
set app.uid = '11111111-1111-1111-1111-111111111111';
do $$
declare
  v_pub uuid;
  v_a   record;
  v_b   record;
begin
  select c.id into v_pub from public.challenges c where c.name = '30 days of study';

  select * into v_a from public.get_challenge_breakdown(v_pub);
  assert v_a.completion = 100.0 and v_a.consistency = 100.0 and v_a.participation = 100.0,
    'a fully logged day scores 100 on all three components';
  assert v_a.score = 100.0, '0.70 + 0.20 + 0.10 of 100 is 100';
  assert not v_a.is_final, 'a running challenge is not final';

   select * into v_b from public.challenge_scores(v_pub, '22222222-2222-2222-2222-222222222222');
   assert v_b.consistency = 0.0,
     'consistency counts completed minutes against the floor, not planned ones';
   -- challenge_score returns from challenge_logs (per-challenge routine), not
   -- daily_scores: creating the challenge (creator) and joining it (Bob)
   -- materialise each member's existing state into challenge_logs.
   assert (select count(*) from public.challenge_logs cl where cl.challenge_id = v_pub) = 2,
     'creation and joining materialise member state into challenge_logs';
   assert (select cl.completion_pct from public.challenge_logs cl
            where cl.challenge_id = v_pub
              and cl.member_id = '11111111-1111-1111-1111-111111111111') = 100,
     'the creator is scored from her existing study log';
   assert (select cl.completion_pct from public.challenge_logs cl
            where cl.challenge_id = v_pub
              and cl.member_id = '22222222-2222-2222-2222-222222222222') = 0,
     'the joiner is scored from his own log, not the global score';

   assert (select lb.rank from public.get_challenge_leaderboard(v_pub) lb
           where lb.is_me) = 1, 'Alice ranks first on a live score';
  assert (select lb.total_members from public.get_challenge_leaderboard(v_pub) lb
           limit 1) = 2, 'the row carries the full member count, not just the top five';
  assert pg_get_function_result('public.get_challenge_leaderboard'::regproc) =
    'TABLE(user_id uuid, name text, score numeric, rank integer, is_me boolean, '
    || 'has_left boolean, is_final boolean, total_members integer)',
    'the leaderboard is a name, a score and a rank — nothing about the days';
end
$$;

-- Leaving does not erase a run: 0005 filtered the leaderboard to status =
-- 'active', which made walking out a free way to delete a bad score.
set app.uid = '22222222-2222-2222-2222-222222222222';
do $$
declare v_pub uuid;
begin
  select c.id into v_pub from public.challenges c where c.name = '30 days of study';
  perform public.leave_challenge(v_pub);
  assert (select count(*) from public.get_challenge_leaderboard(v_pub)) = 2,
    'a member who left is still ranked';
  assert (select lb.has_left from public.get_challenge_leaderboard(v_pub) lb
           where lb.is_me), 'and is marked as having left';
  begin
    perform public.leave_challenge(v_pub);
    assert false, 'leaving twice must be refused';
  exception when others then null;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- Finalization (§5). Idempotent, and immutable once written.
-- ---------------------------------------------------------------------------
reset app.uid;
do $$
declare v_over uuid;
begin
  select c.id into v_over from public.challenges c where c.name = 'Long over';
  assert public.finalize_challenges() >= 1, 'a finished challenge is scored';
  assert (select c.finalized_at from public.challenges c where c.id = v_over) is not null,
    'and stamped';
  assert (select count(*) from public.challenge_members m
           where m.challenge_id = v_over and m.final_score is not null) = 1,
    'every member of it has a frozen score';
  assert public.finalize_challenges() = 0, 'a second run does nothing';

  begin
    update public.challenge_members set final_score = 99 where challenge_id = v_over;
    assert false, 'a frozen score cannot be rewritten';
  exception when others then null;
  end;
end
$$;

-- A cancelled challenge is stamped but never scored: null reads as "no result",
-- where 0 would read as "everyone failed".
set app.uid = '11111111-1111-1111-1111-111111111111';
do $$
declare v_late uuid;
begin
  select c.id into v_late from public.challenges c where c.name = 'Late arrival';
  perform public.cancel_challenge(v_late);
  assert (select ch.status from public.get_challenge(v_late) ch) = 'cancelled',
    'cancelling shows up in the derived status';
end
$$;

set app.uid = '22222222-2222-2222-2222-222222222222';
do $$
begin
  begin
    perform public.cancel_challenge(
      (select c.id from public.challenges c where c.name = 'Secret sprint'));
    assert false, 'only the owner may cancel';
  exception when others then null;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- Challenge routines and challenge_logs (§11).
-- ---------------------------------------------------------------------------
set app.uid = '11111111-1111-1111-1111-111111111111';
do $$
declare
  v_pub    uuid;
  v_lab    uuid;
  v_routine jsonb;
  v_locked boolean;
  v_logs   integer;
begin
  select c.id into v_pub from public.challenges c where c.name = '30 days of study';

  -- A challenge routine must exist after creation.
  select cr.routine into v_routine from public.challenge_routines cr where cr.challenge_id = v_pub;
  assert v_routine is not null, 'challenge_routines row must exist after create';
  assert jsonb_typeof(v_routine) = 'object', 'routine is a jsonb object keyed by day of week';

  -- The routine must cover all seven days (0-6 = Sunday-Saturday).
  assert (select count(*) from jsonb_object_keys(v_routine) k) = 7, 'routine covers all seven days';
  assert jsonb_array_length(v_routine -> '0') > 0, 'routine has blocks for day 0';
  assert jsonb_array_length(v_routine -> '1') > 0, 'routine has blocks for day 1';

  -- Bob joined this challenge above, so its routine is locked now: no more
  -- edits, not even by the owner. The lock is database-enforced, not UI-only.
  select cr.locked_at is not null into v_locked
    from public.challenge_routines cr where cr.challenge_id = v_pub;
  assert v_locked, 'routine is locked once a member has joined';
  begin
    perform public.update_challenge_routine(v_pub, v_routine);
    assert false, 'update_challenge_routine must fail on a locked routine';
  exception when others then null;
  end;

  -- A fresh challenge starts unlocked: the owner shapes the routine until the
  -- first member joins, and a non-owner can never touch it.
  perform public.create_challenge('Routine lab', 'study', '',
                                  now(), now() + interval '30 days', 'public', null, 30);
  select c.id into v_lab from public.challenges c where c.name = 'Routine lab';
  select cr.locked_at is not null into v_locked
    from public.challenge_routines cr where cr.challenge_id = v_lab;
  assert not v_locked, 'routine is unlocked before any member joins';

  perform public.update_challenge_routine(v_lab, v_routine);

  set app.uid = '22222222-2222-2222-2222-222222222222';
  begin
    perform public.update_challenge_routine(v_lab, v_routine);
    assert false, 'only the owner may edit the routine';
  exception when others then null;
  end;

  perform public.join_challenge(v_lab);
  select cr.locked_at is not null into v_locked
    from public.challenge_routines cr where cr.challenge_id = v_lab;
  assert v_locked, 'routine is locked after first member joins';

  begin
    perform public.update_challenge_routine(v_lab, v_routine);
    assert false, 'update_challenge_routine must fail on a locked routine';
  exception when others then null;
  end;

  -- Joining initialized challenge logs for the new member from existing state.
  select count(*)::integer into v_logs
    from public.challenge_logs
   where challenge_id = v_lab
     and member_id = '22222222-2222-2222-2222-222222222222';
  assert v_logs > 0, 'challenge_logs are initialized when a member joins';
end
$$;

-- ---------------------------------------------------------------------------
-- The posture. 0005 shipped three tables with no RLS and no grants, and its
-- `drop table challenge_members cascade` took 0001's policy with it.
-- ---------------------------------------------------------------------------
do $$
declare v_bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  assert v_bad is null, format('tables in public without RLS: %s', v_bad);

  select string_agg(p.proname, ', ' order by p.proname) into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%';
  assert v_bad is null, format('definer functions with an unpinned search_path: %s', v_bad);
end
$$;

set role authenticated;
set app.uid = '11111111-1111-1111-1111-111111111111';
do $$
declare
  v_tbl text;
  v_ok  boolean;
begin
  -- The three internal tables are reachable only through the RPCs.
  foreach v_tbl in array array['pairing_requests', 'challenge_invites', 'daily_scores']
  loop
    v_ok := false;
    begin
      execute format('select 1 from public.%I limit 1', v_tbl);
    exception when insufficient_privilege then v_ok := true;
    end;
    assert v_ok, format('public.%s must not be readable by authenticated', v_tbl);
  end loop;

  -- challenge_members is readable, but only your own rows.
  assert (select count(*) from public.challenge_members) =
         (select count(*) from public.challenge_members m
           where m.user_id = '11111111-1111-1111-1111-111111111111'),
    'challenge_members must expose own rows only';
end
$$;

do $$
begin
  begin
    perform public.challenge_join_internal(
      (select c.id from public.challenges c where c.name = 'Secret sprint'), true);
    assert false, 'challenge_join_internal must not be callable by a client';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;
\echo 'smoke_pairing_challenges: all assertions passed'




