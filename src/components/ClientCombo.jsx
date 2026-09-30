import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronIcon, CloseIcon, StarIcon } from './Icons.jsx';

function isPrintable(e) {
  return e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
}

// Custom dropdown (instead of a <select>) so each client can carry a star.
export default function ClientCombo({
  clients,        // every client
  matches,        // clients matching the current search
  nameCounts,
  starred,
  selectedKey,
  loading,
  onSelect,
  onClearSelection,
  onToggleStar,
}) {
  const comboRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);

  const typeBuffer = useRef('');
  const typeTimer = useRef(null);
  const pendingChar = useRef(null);     // first letter typed on the closed trigger, applied once the list is open
  const starFocus = useRef(null);       // scroll/focus to restore after a star moves a row

  const selected = clients.find((c) => c.key === selectedKey);
  const pinned = matches.filter((c) => starred.has(c.key));
  const rest = matches.filter((c) => !starred.has(c.key));

  const triggerText = selected
    ? nameCounts[selected.name.toLowerCase()] > 1 ? `${selected.name} (${selected.email})` : selected.name
    : loading && !clients.length ? 'Loading...'
    : !clients.length ? 'No clients loaded'
    : matches.length ? 'Select a client...'
    : 'No matching clients';

  const opts = () => Array.from(listRef.current.querySelectorAll('.opt'));

  // Type a letter while the list is open to jump to clients starting with it (like a normal dropdown)
  const typeAhead = (ch) => {
    typeBuffer.current += ch.toLowerCase();
    clearTimeout(typeTimer.current);
    typeTimer.current = setTimeout(() => { typeBuffer.current = ''; }, 600);
    const hit = opts().find((b) => b.dataset.name.startsWith(typeBuffer.current));
    if (hit) hit.focus();
  };

  // Move focus into the list when it opens
  useEffect(() => {
    if (!open) return;
    const target = listRef.current.querySelector('.opt[aria-current="true"]') || listRef.current.querySelector('.opt');
    if (target) target.focus(); else panelRef.current.focus();
    if (pendingChar.current) {
      typeAhead(pendingChar.current);
      pendingChar.current = null;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close when clicking or tabbing somewhere else
  useEffect(() => {
    const away = (e) => {
      if (comboRef.current && !comboRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('focusin', away);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('focusin', away);
    };
  }, []);

  // After a star moves a client to its new spot, keep the scroll position and (for keyboard users) the focus
  useLayoutEffect(() => {
    const s = starFocus.current;
    if (!s) return;
    starFocus.current = null;
    panelRef.current.scrollTop = s.scroll;
    if (s.hadFocus) {
      const again = Array.from(listRef.current.querySelectorAll('.star')).find((b) => b.dataset.key === s.key);
      if (again) again.focus({ preventScroll: s.preventScroll });
    }
  }, [starred]);

  const closePanel = (returnFocus) => {
    setOpen(false);
    if (returnFocus) triggerRef.current.focus();
  };

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    } else if (isPrintable(e)) {
      e.preventDefault();
      pendingChar.current = e.key;
      setOpen(true);
    }
  };

  const handlePanelKeyDown = (e) => {
    const all = opts();
    const row = e.target.closest('.opt-row');
    const idx = row ? all.indexOf(row.querySelector('.opt')) : -1;
    const go = (b) => { if (b) { e.preventDefault(); b.focus(); } };

    if (e.key === 'ArrowDown') go(all[Math.min(idx + 1, all.length - 1)]);
    else if (e.key === 'ArrowUp') go(all[Math.max(idx - 1, 0)]);
    else if (e.key === 'Home') go(all[0]);
    else if (e.key === 'End') go(all[all.length - 1]);
    else if (e.key === 'ArrowRight' && row && e.target.classList.contains('opt')) go(row.querySelector('.star'));
    else if (e.key === 'ArrowLeft' && row && e.target.classList.contains('star')) go(row.querySelector('.opt'));
    else if (e.key === 'Escape') { e.preventDefault(); closePanel(true); }
    else if (isPrintable(e)) { e.preventDefault(); typeAhead(e.key); }
  };

  const handleStar = (e, c) => {
    starFocus.current = {
      key: c.key,
      hadFocus: panelRef.current.contains(document.activeElement),
      scroll: panelRef.current.scrollTop,
      // Keyboard users follow the client to its new spot; mouse users keep their scroll position
      preventScroll: e.detail > 0,
    };
    onToggleStar(c.key);
  };

  const renderRow = (c) => {
    const isCurrent = c.key === selectedKey;
    const on = starred.has(c.key);
    const meta = [];
    if (nameCounts[c.name.toLowerCase()] > 1) meta.push(c.email);
    if (!c.hasSlots) meta.push('no schedule yet');

    return (
      <li key={c.key} className={'opt-row' + (isCurrent ? ' is-current' : '')}>
        <button
          type="button"
          className="opt"
          data-name={c.name.toLowerCase()}
          aria-current={isCurrent ? 'true' : undefined}
          onClick={() => { closePanel(true); onSelect(c.key); }}
        >
          <span className="opt-name">{c.name}</span>
          {meta.length > 0 && <span className="opt-meta">{meta.join(', ')}</span>}
        </button>
        <button
          type="button"
          className="star"
          data-key={c.key}
          aria-pressed={on}
          aria-label={`Star ${c.name}`}
          title={on ? 'Unstar (move back into the list)' : 'Star (keep at the top of the list)'}
          onClick={(e) => handleStar(e, c)}
        >
          <StarIcon />
        </button>
      </li>
    );
  };

  return (
    <div className="field">
      <div className="field-label" id="clientLabel">Client</div>
      <div className={'combo' + (open ? ' open' : '') + (selected ? ' has-value' : '')} ref={comboRef}>
        <button
          type="button"
          className="combo-trigger"
          ref={triggerRef}
          aria-expanded={open}
          aria-controls="clientPanel"
          aria-labelledby="clientLabel clientValue"
          disabled={clients.length === 0}
          onClick={() => (open ? closePanel(true) : setOpen(true))}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className={'combo-value' + (selected ? '' : ' placeholder')} id="clientValue">{triggerText}</span>
          <ChevronIcon />
        </button>
        <button
          type="button"
          className="clear-btn"
          aria-label="Clear client selection"
          title="Clear selection"
          hidden={!selected}
          onClick={() => {
            closePanel(false);
            onClearSelection();
            triggerRef.current.focus();
          }}
        >
          <CloseIcon />
        </button>
        <div className="combo-panel" id="clientPanel" tabIndex={-1} ref={panelRef} hidden={!open} onKeyDown={handlePanelKeyDown}>
          <ul className="opt-list" ref={listRef}>
            {!matches.length ? (
              <li className="opt-note">{clients.length ? 'No clients match your search.' : 'No clients loaded.'}</li>
            ) : (
              <>
                {pinned.length > 0 && (
                  <>
                    <li className="opt-group" role="presentation">Starred</li>
                    {pinned.map(renderRow)}
                    {rest.length > 0 && <li className="opt-group divided" role="presentation">All clients</li>}
                  </>
                )}
                {rest.map(renderRow)}
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
