-- Ordo — add redo support via a separate redo stack on user_state.
-- When undo_state() pops from history, the outgoing state lands in redo.
-- When redo_state() pops from redo, the outgoing state lands in history.
-- save_state() clears redo since a new action invalidates the redo branch.

alter table public.user_state
  add column if not exists redo jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- redo_state — pop the newest redo entry back into place.
-- ---------------------------------------------------------------------------
create or replace function public.redo_state()
returns jsonb
language plpgsql
security definer
set search_path = public
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

  -- Push the current state onto the history stack before restoring.
  update public.user_state
     set state = v_next,
         history = coalesce(history, '[]'::jsonb) || jsonb_build_array(state),
         redo = v_redo - (v_len - 1),
         updated_at = now()
   where user_id = v_uid;

  return v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- update save_state to clear the redo stack on any new write
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
    insert into public.user_state (user_id, state, history, redo)
      values (v_uid, p_state, '[]'::jsonb, '[]'::jsonb);
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
end;
$$;

-- ---------------------------------------------------------------------------
-- update undo_state to push the current state onto the redo stack
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
     set state = v_prev,
         history = v_hist - (v_len - 1),
         redo = coalesce(redo, '[]'::jsonb) || jsonb_build_array(state),
         updated_at = now()
   where user_id = v_uid;

  return v_prev;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.redo_state() from public, anon, authenticated;
grant execute on function public.redo_state() to authenticated;

revoke execute on function
  public.save_state(jsonb),
  public.undo_state()
from public, anon, authenticated;
grant execute on function
  public.save_state(jsonb),
  public.undo_state()
to authenticated;