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

## Layout

```
src/
  App.jsx                  page state: search text, selected client
  hooks/useClients.js      loads + refreshes clients from Supabase
  hooks/useStarred.js      per-browser starred clients (localStorage)
  lib/supabase.js          Supabase client
  lib/clients.js           fetch/merge clients, search ranking helpers
  lib/time.js              slot parsing and timezone conversion (display tz = EST)
  components/
    Header.jsx  SearchBox.jsx  ClientCombo.jsx
    ScheduleCard.jsx  DetailCard.jsx  Roster.jsx  Icons.jsx
  styles.css               unchanged from the original single-file page
```
