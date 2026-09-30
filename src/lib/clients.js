import { supabase } from './supabase.js';
import { groupByDate, hasSlots } from './time.js';

// Fetch allowed_users + schedules and merge them into one sorted client list:
// [{ key, name, email, schedule, hasSlots, days, slots }]
export async function fetchClients() {
  const [usersRes, schedRes] = await Promise.all([
    supabase.from('allowed_users').select('*'),
    supabase.from('schedules').select('*'),
  ]);

  if (usersRes.error) throw new Error('allowed_users: ' + usersRes.error.message);
  if (schedRes.error) throw new Error('schedules: ' + schedRes.error.message);

  const byEmail = new Map();

  (usersRes.data || []).forEach((row) => {
    const email = (row['REGISTERED EMAIL'] || '').trim();
    if (!email) return;
    const key = email.toLowerCase();
    byEmail.set(key, {
      key,
      name: (row['CLIENT NAME'] || '').trim() || email,
      email,
      schedule: null,
    });
  });

  // Attach schedules; include any schedule whose email is no longer in allowed_users
  (schedRes.data || []).forEach((row) => {
    const email = (row.user_email || '').trim();
    if (!email) return;
    const key = email.toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, { key, name: email, email, schedule: null });
    byEmail.get(key).schedule = row;
  });

  return Array.from(byEmail.values())
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
        a.email.localeCompare(b.email, undefined, { sensitivity: 'base' })
    )
    .map((c) => {
      // Dates and slots per client, worked out once per load
      const days = groupByDate(c.schedule);
      return {
        ...c,
        hasSlots: hasSlots(c.schedule),
        days: days.length,
        slots: days.reduce((n, d) => n + d.mins.length, 0),
      };
    });
}

// ---------- Search helpers ----------

export function matchesSearch(client, term) {
  if (!term) return true;
  return client.name.toLowerCase().includes(term) || client.email.toLowerCase().includes(term);
}

// Index where `term` starts a word in `text` (e.g. "ab" in "John Abbott"), or -1
export function wordStart(text, term) {
  let i = text.indexOf(term);
  while (i !== -1) {
    if (i === 0 || !/[a-z0-9]/i.test(text[i - 1])) return i;
    i = text.indexOf(term, i + 1);
  }
  return -1;
}

// Names starting with the search come first, then names with a word starting with it,
// then any other match. Each group stays alphabetical.
export function rankedMatches(clients, term) {
  const rank = (c) => {
    const n = c.name.toLowerCase();
    if (n.startsWith(term)) return 0;
    if (wordStart(n, term) > 0) return 1;
    if (n.includes(term)) return 2;
    return 3; // matched on email only
  };
  return clients
    .filter((c) => matchesSearch(c, term))
    .map((c) => ({ c, r: rank(c) }))
    .sort((a, b) => a.r - b.r) // stable sort keeps the alphabetical order inside each group
    .map((x) => x.c);
}

// Starred clients first, everyone else after; each group keeps its order
export function starredFirst(list, starred) {
  return list.filter((c) => starred.has(c.key)).concat(list.filter((c) => !starred.has(c.key)));
}
