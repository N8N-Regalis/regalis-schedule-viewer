import { useMemo, useState } from 'react';
import { CONFLICT_CODE, saveClientSlots } from '../lib/scheduleEdits.js';
import {
  DISPLAY_TZ,
  DISPLAY_TZ_LABEL,
  displaySlots,
  formatHours,
  minutesToTime,
  slotIdFromDisplay,
  slotKeys,
  toRanges,
} from '../lib/time.js';

const STEP = 30;
const DAY_END = 24 * 60;
const FROM_OPTIONS = Array.from({ length: DAY_END / STEP }, (_, i) => i * STEP);
const TO_OPTIONS = Array.from({ length: DAY_END / STEP }, (_, i) => (i + 1) * STEP);
const endLabel = (m) => (m >= DAY_END ? '12:00 AM (midnight)' : minutesToTime(m));

const slotKey = (dateKey, mins) => `${dateKey}|${mins}`;

// Edit a client's available times. Works in the display timezone (EST), like the read-only list,
// and converts back to the client's own timezone on save. Slots that already exist keep their
// saved ids untouched, and ids that can't be parsed are carried through unchanged.
// Remount per client (key={client.key}). `onSaved` runs after a successful save (refresh + leave edit
// mode); `onStale` only refreshes the data when the save was refused because it changed underneath.
export default function ScheduleEditor({ client, onCancel, onSaved, onStale }) {
  const sched = client.schedule;

  // Snapshot taken when editing starts; `base` is what the database must still hold for the save to go through
  const [initial] = useState(() => {
    const entries = displaySlots(sched);
    const parsed = new Set(entries.map((e) => e.id));
    const all = slotKeys(sched);
    return {
      entries,
      byKey: new Map(entries.map((e) => [slotKey(e.dateKey, e.mins), e])),
      unparsed: all.filter((id) => !parsed.has(id)),
      hadSlots: all.length > 0,
      base: sched && sched.slots != null ? sched.slots : null,
      isArray: Array.isArray(sched && sched.slots),
      tz: sched && sched.timezone ? sched.timezone : '',
    };
  });

  const [draft, setDraft] = useState(() => new Map(initial.byKey)); // slotKey -> { id|null, dateKey, mins }
  const [date, setDate] = useState('');
  const [from, setFrom] = useState(9 * 60);
  const [to, setTo] = useState(17 * 60);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');

  const days = useMemo(() => {
    const byDate = new Map();
    draft.forEach(({ dateKey, mins }) => {
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey).push(mins);
    });
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateKey, mins]) => ({ dateKey, mins: mins.sort((a, b) => a - b) }));
  }, [draft]);

  const added = Array.from(draft.values()).filter((e) => e.id === null).length;
  const removed = initial.entries.filter((e) => !draft.has(slotKey(e.dateKey, e.mins))).length;
  const changed = added > 0 || removed > 0;
  const rangeOk = to > from;

  const addRange = () => {
    if (!date || !rangeOk) return;
    setDraft((prev) => {
      const next = new Map(prev);
      for (let m = from; m < to; m += STEP) {
        const k = slotKey(date, m);
        if (!next.has(k)) next.set(k, initial.byKey.get(k) || { id: null, dateKey: date, mins: m });
      }
      return next;
    });
  };

  const removeMins = (dateKey, minsList) => {
    setDraft((prev) => {
      const next = new Map(prev);
      minsList.forEach((m) => next.delete(slotKey(dateKey, m)));
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const ids = Array.from(draft.values()).map(
        (e) => e.id ?? slotIdFromDisplay(e.dateKey, e.mins, initial.tz)
      );
      const all = ids.concat(initial.unparsed);
      const slots = initial.isArray ? all : Object.fromEntries(all.map((id) => [id, true]));
      // A client with no timezone and no slots yet gets EST, the zone this editor works in
      const timezone = !initial.tz && !initial.hadSlots ? DISPLAY_TZ : null;
      await saveClientSlots(client.email, slots, initial.base, timezone);
      await onSaved();
    } catch (err) {
      if (err.code === CONFLICT_CODE) {
        setConflict(true);
        setError(err.message + '. Nothing was saved. Cancel, then edit the latest version.');
        onStale();
      } else {
        console.error(err);
        setError('Could not save: ' + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor">
      <p className="editor-note">
        Editing in {DISPLAY_TZ_LABEL}.
        {initial.tz ? ' Times are converted back to the client\'s timezone when saved.' : ''}
        {' '}Every change is recorded with your email and the time.
      </p>

      <div className="editor-add">
        <div className="field">
          <label htmlFor="se-date">Date</label>
          <input id="se-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
        </div>
        <div className="field">
          <label htmlFor="se-from">From</label>
          <select id="se-from" value={from} onChange={(e) => setFrom(Number(e.target.value))} disabled={saving}>
            {FROM_OPTIONS.map((m) => <option key={m} value={m}>{minutesToTime(m)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="se-to">To</label>
          <select id="se-to" value={to} onChange={(e) => setTo(Number(e.target.value))} disabled={saving}>
            {TO_OPTIONS.map((m) => <option key={m} value={m}>{endLabel(m)}</option>)}
          </select>
        </div>
        <button type="button" onClick={addRange} disabled={!date || !rangeOk || saving}>Add times</button>
      </div>
      {!rangeOk && <div className="internal-error">"To" must be after "From".</div>}

      {days.length ? (
        <div className="day-scroll" tabIndex={0} role="region" aria-label="Available dates being edited, scrollable">
          <ul className="day-list">
            {days.map((day) => {
              const [y, mo, d] = day.dateKey.split('-').map(Number);
              const dt = new Date(y, mo - 1, d);
              return (
                <li className="day" key={day.dateKey}>
                  <div className="day-date">
                    {dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    <small>{dt.toLocaleDateString('en-US', { weekday: 'long' }) + ', ' + y}</small>
                  </div>
                  <div className="chips">
                    {toRanges(day.mins).map((r) => {
                      const label = `${minutesToTime(r.start)} - ${endLabel(r.end)}`;
                      const slotsInRange = [];
                      for (let m = r.start; m < r.end; m += STEP) slotsInRange.push(m);
                      return (
                        <span className="chip editable" key={r.start}>
                          {label}
                          <button
                            type="button"
                            className="chip-x"
                            aria-label={`Remove ${label} on ${dt.toLocaleDateString('en-US')}`}
                            onClick={() => removeMins(day.dateKey, slotsInRange)}
                            disabled={saving}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <div className="day-tools">
                    <div className="day-total">{formatHours(day.mins.length)}</div>
                    <button type="button" onClick={() => removeMins(day.dateKey, day.mins)} disabled={saving}>
                      Remove day
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="notes empty">No times selected. Pick a date and time range above, then Add times.</div>
      )}

      <div className="internal-actions">
        <button type="button" onClick={save} disabled={!changed || saving || conflict}>
          {saving ? 'Saving...' : 'Save schedule'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        <span className="internal-meta">
          {changed ? `${added} slot${added === 1 ? '' : 's'} added, ${removed} removed (30 min each)` : 'No changes yet.'}
        </span>
      </div>
      {error && <div className="internal-error" role="alert">{error}</div>}
    </div>
  );
}
