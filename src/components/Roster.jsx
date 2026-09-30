import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { matchesSearch, starredFirst } from '../lib/clients.js';
import { StarIcon } from './Icons.jsx';

const TABS = [
  { filter: 'with', label: 'With schedule' },
  { filter: 'without', label: 'No schedule' },
  { filter: 'all', label: 'All clients' },
];

// A running list of everyone in allowed_users, split by whether they have saved times yet.
export default function Roster({ clients, term, rawTerm, starred, selectedKey, onSelect, onClearSearch }) {
  const [filter, setFilter] = useState('with'); // 'with' | 'without' | 'all'
  const scrollRef = useRef(null);
  const scrolledTo = useRef(''); // stops the selected row being re-scrolled on every render

  const visible = useMemo(() => clients.filter((c) => matchesSearch(c, term)), [clients, term]);
  const withCount = visible.filter((c) => c.hasSlots).length;
  const counts = { with: withCount, without: visible.length - withCount, all: visible.length };

  const rows = useMemo(() => {
    let list = visible;
    if (filter === 'with') list = list.filter((c) => c.hasSlots);
    else if (filter === 'without') list = list.filter((c) => !c.hasSlots);
    // Starred clients sit at the top here too, so they match the dropdown
    return starredFirst(list, starred);
  }, [visible, filter, starred]);

  // Bring a newly picked client into view without moving the rest of the page
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!rows.length) {
      scrolledTo.current = '';
      return;
    }
    if (selectedKey && selectedKey !== scrolledTo.current) {
      const cur = box.querySelector('tr.is-current');
      if (cur) {
        const headRoom = 34; // the sticky header sits over the top of the box
        const top = cur.offsetTop;
        const bottom = top + cur.offsetHeight;
        const viewTop = box.scrollTop;
        const viewBottom = viewTop + box.clientHeight;
        if (top - headRoom < viewTop) box.scrollTop = Math.max(0, top - headRoom);
        else if (bottom > viewBottom) box.scrollTop = bottom - box.clientHeight;
      }
    }
    scrolledTo.current = selectedKey;
  }, [rows, selectedKey]);

  const pickTab = (f) => {
    scrollRef.current.scrollTop = 0;
    scrolledTo.current = '';
    setFilter(f);
  };

  const emptyText = !clients.length ? 'No clients loaded yet.'
    : term ? 'No clients here match your search.'
    : filter === 'with' ? 'No client has saved a schedule yet.'
    : filter === 'without' ? 'Every client has saved a schedule.'
    : 'No clients to show.';

  return (
    <section className="card" aria-label="Client roster">
      <div className="roster-head">
        <h2>Client roster</h2>
        <span className="roster-count">{rows.length === 1 ? '1 client' : `${rows.length} clients`}</span>
      </div>
      <p className="roster-sub">Click a client to open their availability.</p>

      <div className="tabs" role="tablist" aria-label="Filter the roster">
        {TABS.map((t) => (
          <button
            key={t.filter}
            type="button"
            className="tab"
            role="tab"
            aria-selected={filter === t.filter}
            onClick={() => pickTab(t.filter)}
          >
            <span className="tab-n">{counts[t.filter]}</span>{t.label}
          </button>
        ))}
      </div>

      <p className="roster-filter" hidden={!term}>
        <span>Matching</span>
        <span className="term">{term ? `"${rawTerm}"` : ''}</span>
        <button type="button" onClick={onClearSearch}>Show all</button>
      </p>

      <div className="roster-scroll" ref={scrollRef}>
        <table className="roster">
          <thead>
            <tr><th scope="col">Client</th><th scope="col" className="num">Dates</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={2} className="roster-empty">{emptyText}</td></tr>
            ) : (
              rows.map((c) => (
                <RosterRow
                  key={c.key}
                  client={c}
                  starred={starred.has(c.key)}
                  current={c.key === selectedKey}
                  onSelect={onSelect}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RosterRow({ client: c, starred, current, onSelect }) {
  const pick = () => onSelect(c.key);
  return (
    <tr
      tabIndex={0}
      className={current ? 'is-current' : undefined}
      aria-current={current ? 'true' : undefined}
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      }}
    >
      <td>
        <div className="r-name">
          {starred && <span className="r-star" title="Starred"><StarIcon /></span>}
          <span className="txt" title={c.name}>{c.name}</span>
        </div>
        <div className="r-email">{c.email}</div>
        {c.schedule && c.schedule.updated_at && (
          <div className="r-saved">
            Saved {new Date(c.schedule.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </td>
      {c.days ? (
        <td className="r-count">
          {c.days}
          <small>{`${c.slots} slot${c.slots === 1 ? '' : 's'}`}</small>
        </td>
      ) : (
        <td className="r-count none">
          {'—'}
          <small>{c.schedule ? 'no times' : 'not saved'}</small>
        </td>
      )}
    </tr>
  );
}
