# Regalis Schedule Viewer

Internal viewer for client availability, built with React + Vite. Reads the `allowed_users` and
`schedules` tables from Supabase (same project as the client portal).

## Run

```
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run preview  # serve the production build
```

Optionally copy `.env.example` to `.env` to point at a different Supabase project.

## Google sign-in (@regaliscapital.com only)

Sign-in uses Supabase Auth with the Google provider.

1. Google Cloud Console: create an OAuth client (Web application). Add the authorized redirect URI
   `https://pzcfrocmwmhyygzgecpl.supabase.co/auth/v1/callback`. If the OAuth consent screen can be set to
   "Internal" (Regalis Google Workspace), do that: Google then rejects other domains itself.
2. Supabase Dashboard > Authentication > Providers > Google: enable it, paste the client ID and secret.
3. Supabase Dashboard > Authentication > URL Configuration: add the site URL and the app URLs
   (GitHub Pages URL and `http://localhost:5173`) to the redirect allow list.
4. Apply `supabase-auth-setup.sql` (after reading its warning). Without it, the domain check only
   hides the UI; anyone with the public anon key could still query the tables directly.

The domain is set in `src/lib/auth.js` (`ALLOWED_DOMAIN`).

## Staff edits and history

Signed-in staff can edit a client's available times ("Edit schedule"), their special instructions, and
the staff-only internal notes. Every edit is logged with the editor's email, the time, and the before/after
values, and the log is shown under each section.

Apply these in the Supabase SQL Editor (review first; both are safe to re-run):

- `supabase-internal-notes-setup.sql` - internal notes + their history
- `supabase-schedule-edit-setup.sql` - schedule / special-instruction edits + history (`schedule_history`)

Staff never write to `schedules` directly: the app calls `save_client_slots()` / `save_client_notes()`,
which check the caller is a verified @regaliscapital.com user, take the editor's email from the login
token, and write the change and its history row in one transaction. A save is refused if the value
changed since it was loaded (for example, the client re-saved in the portal while staff were editing).

## Internal notes and history

The details card has a staff-only "Internal notes" box under Special instructions, plus an edit history
(who changed it, when, and the before/after text). Run `supabase-internal-notes-setup.sql` in the Supabase
SQL Editor first; until then the box shows a load error and the rest of the app works as before.

- Notes live in `client_internal_notes` and the log in `internal_notes_history`, not in `schedules`, so the
  client portal can never read them.
- Both tables are read-only to `@regaliscapital.com` staff; all writes go through `save_internal_notes()`,
  which takes the editor's email from their login token and refuses a save if someone else edited first.

## Layout

```
src/
  App.jsx                  page state: search text, selected client
  hooks/useClients.js      loads + refreshes clients from Supabase
  hooks/useStarred.js      per-browser starred clients (localStorage)
  lib/supabase.js          Supabase client
  lib/clients.js           fetch/merge clients, search ranking helpers
  lib/internalNotes.js     internal notes + history queries, save via RPC
  lib/time.js              slot parsing and timezone conversion (display tz = EST)
  components/
    Header.jsx  SearchBox.jsx  ClientCombo.jsx
    ScheduleCard.jsx  DetailCard.jsx  InternalNotes.jsx  Roster.jsx  Icons.jsx
  styles.css               unchanged from the original single-file page
```
