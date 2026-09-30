import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  DISPLAY_TZ_LABEL,
  formatHours,
  groupByDate,
  minutesToTime,
  todayInDisplayTz,
  toRanges,
} from '../lib/time.js';

// Left-hand card: empty state, load error, or the selected client's availability list.
export default function ScheduleCard({ client, error }) {
  return (
    <section className="card" aria-live="polite">
      {error ? (
        <div className="state error">
          <h2>Couldn't load schedules</h2>
          <p>{error}</p>
        </div>
      ) : client ? (
        <ScheduleView client={client} />
      ) : (
        <div className="state">
          <h2>No client selected</h2>
          <p>Pick a client from the dropdown, or search by name or email.</p>
        </div>
      )}
    </section>
  );
}

function ScheduleView({ client }) {
  const scrollRef = useRef(null);
  const firstUpcomingRef = useRef(null);

  const sched = client.schedule;
  const tz = sched && sched.timezone ? sched.timezone : '';
  const days = useMemo(() => groupByDate(sched), [sched]);
  const todayKey = todayInDisplayTz(); // YYYY-MM-DD in EST
  const pastCount = days.filter((d) => d.dateKey < todayKey).length;
  const firstUpcomingKey = (days.find((d) => d.dateKey >= todayKey) || {}).dateKey;
  const none = days.length === 0;

  // Scroll the availability box to a row without moving the page
  const scrollToUpcoming = () => {
    const li = firstUpcomingRef.current;
    if (li && scrollRef.current) scrollRef.current.scrollTop = Math.max(0, li.offsetTop - 8);
  };

  // A different client starts at the top of their list (or at today if past dates come first);
  // data refreshes for the same client keep their place.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (pastCount && firstUpcomingKey) scrollToUpcoming();
  }, [client.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="list-head">
        <div>
          <h2>Available dates for {client.name}</h2>
          <p>
            {tz
              ? `Times are converted to ${DISPLAY_TZ_LABEL}`
              : `The client has not set a timezone, so times are shown as saved (not converted to ${DISPLAY_TZ_LABEL}).`}
          </p>
        </div>
        <div className="head-tools">
          <span className="list-count">
            {!none && (
              <>
                <b>{days.length}</b>
                {` date${days.length === 1 ? '' : 's'}`}
                {pastCount > 0 && ` · ${pastCount} past`}
              </>
            )}
          </span>
          {/* Offer the shortcut only when past dates would otherwise sit at the top */}
          <button type="button" id="jumpToday" hidden={!(pastCount && firstUpcomingKey)} onClick={scrollToUpcoming}>
            Jump to today
          </button>
        </div>
      </div>

      {!none && (
        <div className="day-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="Available dates, scrollable">
          <ul className="day-list">
            {days.map((day) => (
              <DayRow
                key={day.dateKey}
                day={day}
                past={day.dateKey < todayKey}
                rowRef={day.dateKey === firstUpcomingKey ? firstUpcomingRef : null}
              />
            ))}
          </ul>
        </div>
      )}

      {none && (
        <div className="state">
          <h2>No times selected</h2>
          <p>
            {sched
              ? `${client.name} saved a schedule but didn't select any time slots.`
              : `${client.name} hasn't saved a schedule in the client portal yet.`}
          </p>
        </div>
      )}
    </div>
  );
}

function DayRow({ day, past, rowRef }) {
  const [y, mo, d] = day.dateKey.split('-').map(Number);
  const date = new Date(y, mo - 1, d);

  return (
    <li className={'day' + (past ? ' past' : '')} ref={rowRef}>
      <div className="day-date">
        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        {past && <span className="past-tag">Past</span>}
        <small>{date.toLocaleDateString('en-US', { weekday: 'long' }) + ', ' + y}</small>
      </div>
      <div className="chips">
        {toRanges(day.mins).map((r) => (
          <span className="chip" key={r.start}>
            {minutesToTime(r.start)} - {r.end >= 24 * 60 ? '12:00 AM (midnight)' : minutesToTime(r.end)}
          </span>
        ))}
      </div>
      <div className="day-total">{formatHours(day.mins.length)}</div>
    </li>
  );
}
