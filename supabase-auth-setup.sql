-- Server-side enforcement of the @regaliscapital.com restriction.
-- The client-side check in src/lib/auth.js only controls the UI; the anon key is public,
-- so the database must refuse everyone else. NOT applied automatically: review first.
--
-- WARNING: the client portal uses the same Supabase project. If the portal reads these tables
-- as anon or as non-Regalis users, replacing the policies below will break it. Check the
-- existing policies first (Dashboard > Authentication > Policies) and adapt.

create or replace function public.is_regalis_staff()
returns boolean
language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@regaliscapital.com'
     and coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, false);
$$;

-- Example: staff can read both tables. Drop the old anon-read policies once this works.
create policy "staff read allowed_users" on public.allowed_users
  for select to authenticated using (public.is_regalis_staff());

create policy "staff read schedules" on public.schedules
  for select to authenticated using (public.is_regalis_staff());

-- drop policy "<existing anon read policy>" on public.allowed_users;
-- drop policy "<existing anon read policy>" on public.schedules;
