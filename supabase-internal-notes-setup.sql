-- Internal notes + change history for the Schedule Viewer. NOT applied automatically:
-- review, then run in Supabase Dashboard > SQL Editor.
--
-- Why separate tables instead of a column on `schedules`: the client portal shares that table, so a
-- column there could be read (and possibly edited) by clients, and clients with no saved schedule
-- have no row to hold it. These tables are readable by @regaliscapital.com staff only, and the only
-- way to write them is the save_internal_notes() function below.
--
-- Safe to run more than once.

-- Same definition as supabase-auth-setup.sql, repeated so this file runs on its own.
create or replace function public.is_regalis_staff()
returns boolean
language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@regaliscapital.com'
     and coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, false);
$$;

-- Current internal notes, one row per client (user_email is the client's lowercase email).
create table if not exists public.client_internal_notes (
  user_email     text primary key,
  internal_notes text not null default '' check (char_length(internal_notes) <= 10000),
  updated_at     timestamptz not null default now(),
  updated_by     text not null
);

-- Append-only log: one row per edit. old_notes is null for the first note ever saved for a client.
create table if not exists public.internal_notes_history (
  id         bigint generated always as identity primary key,
  user_email text not null,
  edited_by  text not null,
  old_notes  text,
  new_notes  text not null,
  changed_at timestamptz not null default now()
);
create index if not exists internal_notes_history_client_idx
  on public.internal_notes_history (user_email, changed_at desc);

alter table public.client_internal_notes enable row level security;
alter table public.internal_notes_history enable row level security;

-- Staff can read; nobody (including staff) can write directly. No insert/update/delete policies exist.
drop policy if exists "staff read internal notes" on public.client_internal_notes;
create policy "staff read internal notes" on public.client_internal_notes
  for select to authenticated using (public.is_regalis_staff());

drop policy if exists "staff read internal notes history" on public.internal_notes_history;
create policy "staff read internal notes history" on public.internal_notes_history
  for select to authenticated using (public.is_regalis_staff());

revoke all on public.client_internal_notes from anon, authenticated;
revoke all on public.internal_notes_history from anon, authenticated;
grant select on public.client_internal_notes to authenticated;
grant select on public.internal_notes_history to authenticated;

-- The only write path. Runs with owner rights but checks the caller itself, takes the editor's email
-- from their login token (never from the request), and writes the note and its history row together.
--
-- p_expected_updated_at is the updated_at the editor saw when they opened the note (null if there was
-- no note yet). If someone else saved in the meantime, the save is refused (SQLSTATE 40001) instead of
-- silently overwriting their change.
create or replace function public.save_internal_notes(
  p_user_email text,
  p_notes text,
  p_expected_updated_at timestamptz default null
)
returns public.client_internal_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_client  text := lower(btrim(coalesce(p_user_email, '')));
  v_new     text := btrim(coalesce(p_notes, ''));
  v_current public.client_internal_notes;
  v_result  public.client_internal_notes;
begin
  if not public.is_regalis_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_client = '' then
    raise exception 'Client email is required' using errcode = '22023';
  end if;
  if char_length(v_new) > 10000 then
    raise exception 'Internal notes are limited to 10,000 characters' using errcode = '22001';
  end if;

  -- Serialise concurrent saves for the same client
  select * into v_current from public.client_internal_notes
    where user_email = v_client for update;

  if found and p_expected_updated_at is distinct from v_current.updated_at then
    raise exception 'These notes were changed by % while you were editing', v_current.updated_by
      using errcode = '40001';
  end if;
  if not found and p_expected_updated_at is not null then
    raise exception 'These notes were changed while you were editing' using errcode = '40001';
  end if;

  -- Nothing changed: no write, no history row
  if found and v_current.internal_notes = v_new then
    return v_current;
  end if;
  if not found and v_new = '' then
    return null;
  end if;

  insert into public.internal_notes_history (user_email, edited_by, old_notes, new_notes)
    values (v_client, v_editor, case when found then v_current.internal_notes else null end, v_new);

  insert into public.client_internal_notes as n (user_email, internal_notes, updated_at, updated_by)
    values (v_client, v_new, now(), v_editor)
    on conflict (user_email) do update
      set internal_notes = excluded.internal_notes,
          updated_at     = excluded.updated_at,
          updated_by     = excluded.updated_by
    returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.save_internal_notes(text, text, timestamptz) from public, anon;
grant execute on function public.save_internal_notes(text, text, timestamptz) to authenticated;
