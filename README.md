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
