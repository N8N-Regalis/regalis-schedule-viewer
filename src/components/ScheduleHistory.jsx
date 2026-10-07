import { useEffect, useState } from 'react';
import { fetchScheduleHistory } from '../lib/scheduleEdits.js';
import { groupByDate, minutesToTime, slotKeys, toRanges } from '../lib/time.js';

const MAX_DAYS_SHOWN = 40;

const fmt = (iso) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

// "Mon, Oct 12: 9:00 AM - 11:00 AM, 1:00 PM - 2:00 PM" per day, in the display timezone
function dayLines(ids, tz) {
  return groupByDate({ slots: ids, timezone: tz }).map(({ dateKey, mins }) => {
    const [y, mo, d] = dateKey.split('-').map(Number);
    const date = new Date(y, mo - 1, d).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
    const ranges = toRanges(mins).map(
      (r) => `${minutesToTime(r.start)} - ${r.end >= 24 * 60 ? '12:00 AM' : minutesToTime(r.end)}`
    );
    return { dateKey, text: `${date}: ${ranges.join(', ')}` };
  });
}

function SlotLines({ label, ids, tz, kind }) {
  const lines = dayLines(ids, tz);
  if (!lines.length) return null;
  return (
    <div className={`history-text ${kind}`}>
      <small>{label}</small>
      {lines.slice(0, MAX_DAYS_SHOWN).map((l) => <div key={l.dateKey}>{l.text}</div>)}
      {lines.length > MAX_DAYS_SHOWN && <div>+ {lines.length - MAX_DAYS_SHOWN} more days</div>}
    </div>
  );
}

function SlotsEntry({ h }) {
  const before = h.old_value === null ? null : slotKeys({ slots: h.old_value });
  const after = slotKeys({ slots: h.new_value });
  const beforeSet = new Set(before || []);
  const afterSet = new Set(after);
  const added = after.filter((k) => !beforeSet.has(k));
  const removed = (before || []).filter((k) => !afterSet.has(k));
  const kind = before === null ? 'Created schedule'
    : removed.length && added.length ? 'Changed times'
    : added.length ? 'Added times'
    : 'Removed times';
  return (
    <>
      <div className="history-kind">{kind}</div>
      <SlotLines label="Added" ids={added} tz={h.timezone} kind="after" />
      <SlotLines label="Removed" ids={removed} tz={h.timezone} kind="before" />
    </>
  );
}

function NotesEntry({ h }) {
  const before = h.old_value;
  const after = h.new_value;
  const kind = !before ? 'Added instructions' : after === '' ? 'Cleared instructions' : 'Edited instructions';
  return (
    <>
      <div className="history-kind">{kind}</div>
      {before ? <div className="history-text before"><small>Before</small>{before}</div> : null}
      {after !== '' && <div className="history-text after"><small>After</small>{after}</div>}
    </>
  );
}

// Collapsible edit log for one field of a client's schedule: field is 'slots' or 'notes'.
// `refreshKey` changes whenever the schedule is saved, which reloads the log.
export default function ScheduleHistory({ email, field, refreshKey }) {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let current = true;
    fetchScheduleHistory(email, field)
      .then((rows) => {
        if (!current) return;
        setHistory(rows);
        setError('');
      })
      .catch((err) => {
        if (!current) return;
        console.error(err);
        setError('Could not load history: ' + err.message);
      });
    return () => { current = false; };
  }, [email, field, refreshKey]);

  return (
    <div className="history">
      <button type="button" className="history-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : 'Show'} edit history ({history.length})
      </button>
      {error && <div className="internal-error" role="alert">{error}</div>}
      {open && !error && (
        history.length ? (
          <ol className="history-list">
            {history.map((h) => (
              <li key={h.id}>
                <div className="history-head">
                  <b>{h.edited_by}</b>
                  <span>{fmt(h.changed_at)}</span>
                </div>
                {field === 'slots' ? <SlotsEntry h={h} /> : <NotesEntry h={h} />}
              </li>
            ))}
          </ol>
        ) : (
          <div className="notes empty">No edits yet.</div>
        )
      )}
    </div>
  );
}
