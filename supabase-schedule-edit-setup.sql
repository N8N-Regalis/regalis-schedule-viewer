-- Staff editing of client schedules + special instructions, with change history, for the Schedule Viewer.
-- NOT applied automatically: review, then run in Supabase Dashboard > SQL Editor.
-- Run supabase-auth-setup.sql first (or at least have is_regalis_staff() defined; it is repeated below).
--
-- How it works
--   * Staff never write to public.schedules directly. They call save_client_slots() / save_client_notes(),
--     which check the caller is a verified @regaliscapital.com user, take the editor's email from their
--     login token (never from the request), update the schedule, and append a history row, all in one
--     transaction. This file does not touch any existing policy on public.schedules, so the client portal
--     keeps working exactly as before.
--   * Every save is compared against the value the editor loaded (p_expected_*). If the client or another
--     staff member changed it in the meantime, the save is refused (SQLSTATE 40001) instead of silently
--     overwriting their change.
--   * schedule_history is append-only and readable by staff only.
--
-- Safe to run more than once.

create or replace function public.is_regalis_staff()
returns boolean
language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@regaliscapital.com'
     and coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, false);
$$;

-- One row per change. field = 'slots' or 'notes' (notes = the client's "special instructions").
-- old_value is null when there was nothing before (no schedule row yet, or notes were null).
-- timezone is the client's timezone at the time, so slot ids in old_value/new_value can be read correctly.
create table if not exists public.schedule_history (
  id         bigint generated always as identity primary key,
  user_email text not null,
  edited_by  text not null,
  field      text not null check (field in ('slots', 'notes')),
  old_value  jsonb,
  new_value  jsonb not null,
  timezone   text,
  changed_at timestamptz not null default now()
);
create index if not exists schedule_history_client_idx
  on public.schedule_history (user_email, field, changed_at desc);

alter table public.schedule_history enable row level security;

drop policy if exists "staff read schedule history" on public.schedule_history;
create policy "staff read schedule history" on public.schedule_history
  for select to authenticated using (public.is_regalis_staff());

revoke all on public.schedule_history from anon, authenticated;
grant select on public.schedule_history to authenticated;

-- Slot ids that are switched on, from either shape the portal may save: ["2026-10-12_9:00 AM", ...]
-- or {"2026-10-12_9:00 AM": true, ...}.
create or replace function public.schedule_slot_keys(p_slots jsonb)
returns text[]
language sql immutable
as $$
  select coalesce(array_agg(k order by k), '{}')
  from (
    select e as k from jsonb_array_elements_text(
      case when jsonb_typeof(p_slots) = 'array' then p_slots else '[]'::jsonb end) e
    union
    select o.key from jsonb_each(
      case when jsonb_typeof(p_slots) = 'object' then p_slots else '{}'::jsonb end) o
    where o.value not in ('false'::jsonb, 'null'::jsonb, '0'::jsonb, '""'::jsonb)
  ) s;
$$;

-- Replace a client's available slots.
--   p_slots           the full new set, in the same shape the schedule already uses
--   p_expected_slots  the slots value the editor loaded (null if the client had no schedule row)
--   p_timezone        used only when the client has no timezone and no slots yet (the viewer sends EST,
--                     the zone its editor works in); otherwise the client's own timezone is left alone
create or replace function public.save_client_slots(
  p_user_email text,
  p_slots jsonb,
  p_expected_slots jsonb default null,
  p_timezone text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor   text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_client   text := lower(btrim(coalesce(p_user_email, '')));
  v_row      public.schedules;
  v_found    boolean;
  v_old_keys text[];
  v_new_keys text[];
  v_tz       text;
  v_email    text;
begin
  if not public.is_regalis_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_client = '' then
    raise exception 'Client email is required' using errcode = '22023';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) not in ('array', 'object') then
    raise exception 'Slots must be a list or an object' using errcode = '22023';
  end if;

  select * into v_row from public.schedules where lower(btrim(user_email)) = v_client limit 1 for update;
  v_found := found;

  if v_found and v_row.slots is distinct from p_expected_slots then
    raise exception 'This schedule was changed while you were editing' using errcode = '40001';
  end if;
  if not v_found and p_expected_slots is not null then
    raise exception 'This schedule was changed while you were editing' using errcode = '40001';
  end if;

  v_old_keys := public.schedule_slot_keys(case when v_found then v_row.slots end);
  v_new_keys := public.schedule_slot_keys(p_slots);

  if cardinality(v_new_keys) > 20000 then
    raise exception 'Too many slots' using errcode = '22001';
  end if;
  -- Slots that already exist are kept as they are; only newly added ids must look like "YYYY-MM-DD_h:mm AM"
  if exists (
    select 1 from unnest(v_new_keys) k
    where k <> all (v_old_keys)
      and k !~ '^\d{4}-\d{2}-\d{2}_(0?[1-9]|1[0-2]):[0-5]\d (AM|PM)$'
  ) then
    raise exception 'A new slot id is not in the "YYYY-MM-DD_h:mm AM" format' using errcode = '22023';
  end if;

  -- Nothing changed: no write, no history row
  if v_old_keys = v_new_keys then
    return;
  end if;

  if v_found then
    v_tz := v_row.timezone;
    if coalesce(btrim(v_tz), '') = '' and cardinality(v_old_keys) = 0 then
      v_tz := coalesce(p_timezone, v_tz);
    end if;

    insert into public.schedule_history (user_email, edited_by, field, old_value, new_value, timezone)
      values (v_client, v_editor, 'slots', v_row.slots, p_slots, v_tz);

    update public.schedules
       set slots = p_slots, timezone = v_tz, updated_at = now()
     where user_email = v_row.user_email;
  else
    -- No row yet: use the registered email's spelling so the portal finds it
    select btrim("REGISTERED EMAIL") into v_email
      from public.allowed_users where lower(btrim("REGISTERED EMAIL")) = v_client limit 1;
    v_tz := p_timezone;

    insert into public.schedule_history (user_email, edited_by, field, old_value, new_value, timezone)
      values (v_client, v_editor, 'slots', null, p_slots, v_tz);

    insert into public.schedules (user_email, slots, timezone, updated_at)
      values (coalesce(v_email, btrim(p_user_email)), p_slots, v_tz, now());
  end if;
end;
$$;

-- Replace a client's special instructions.
--   p_expected_notes  the notes value the editor loaded (null if the client had no schedule row or no notes)
create or replace function public.save_client_notes(
  p_user_email text,
  p_notes text,
  p_expected_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_client text := lower(btrim(coalesce(p_user_email, '')));
  v_new    text := btrim(coalesce(p_notes, ''));
  v_row    public.schedules;
  v_found  boolean;
  v_email  text;
begin
  if not public.is_regalis_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_client = '' then
    raise exception 'Client email is required' using errcode = '22023';
  end if;
  if char_length(v_new) > 10000 then
    raise exception 'Special instructions are limited to 10,000 characters' using errcode = '22001';
  end if;

  select * into v_row from public.schedules where lower(btrim(user_email)) = v_client limit 1 for update;
  v_found := found;

  if v_found and v_row.notes is distinct from p_expected_notes then
    raise exception 'These special instructions were changed while you were editing' using errcode = '40001';
  end if;
  if not v_found and p_expected_notes is not null then
    raise exception 'These special instructions were changed while you were editing' using errcode = '40001';
  end if;

  -- Nothing changed: no write, no history row
  if v_found and btrim(coalesce(v_row.notes, '')) = v_new then
    return;
  end if;
  if not v_found and v_new = '' then
    return;
  end if;

  insert into public.schedule_history (user_email, edited_by, field, old_value, new_value, timezone)
    values (
      v_client, v_editor, 'notes',
      case when v_found then to_jsonb(v_row.notes) end,
      to_jsonb(v_new),
      case when v_found then v_row.timezone end
    );

  if v_found then
    update public.schedules set notes = v_new, updated_at = now() where user_email = v_row.user_email;
  else
    select btrim("REGISTERED EMAIL") into v_email
      from public.allowed_users where lower(btrim("REGISTERED EMAIL")) = v_client limit 1;
    insert into public.schedules (user_email, notes, updated_at)
      values (coalesce(v_email, btrim(p_user_email)), v_new, now());
  end if;
end;
$$;

revoke all on function public.save_client_slots(text, jsonb, jsonb, text) from public, anon;
revoke all on function public.save_client_notes(text, text, text) from public, anon;
grant execute on function public.save_client_slots(text, jsonb, jsonb, text) to authenticated;
grant execute on function public.save_client_notes(text, text, text) to authenticated;

-- Make the API pick up the new tables/functions right away (otherwise: "table not found in the schema cache")
notify pgrst, 'reload schema';
