-- create_telegram_code pinned `search_path = public` (correct — a SECURITY
-- DEFINER function must not inherit the caller's path), but Supabase installs
-- pgcrypto into the `extensions` schema, so `gen_random_bytes` was unresolvable
-- and every attempt to mint a link code failed with 42883.
--
-- Rather than widen the search_path or schema-qualify an extension that a
-- self-hosted deployment might place elsewhere, derive the code from
-- gen_random_uuid(), which lives in pg_catalog on Postgres 13+ and is therefore
-- always in scope. Same output shape: 8 uppercase hex characters.

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

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.telegram_codes (code, user_id, expires_at)
  values (v_code, v_uid, now() + interval '15 minutes')
  on conflict (code) do update
    set user_id = excluded.user_id, expires_at = excluded.expires_at;

  return v_code;
end;
$$;

revoke execute on function public.create_telegram_code() from public, anon, authenticated;
grant execute on function public.create_telegram_code() to authenticated;
