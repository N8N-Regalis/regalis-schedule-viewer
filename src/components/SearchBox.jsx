import { useEffect, useMemo, useRef, useState } from 'react';
import { rankedMatches, wordStart } from '../lib/clients.js';
import { CloseIcon } from './Icons.jsx';

const MAX_SUGGESTIONS = 8;

// Wraps the first word-start (or any) occurrence of `term` in <mark>. `hit` is false when there is none.
function highlight(text, term) {
  const lower = text.toLowerCase();
  let i = wordStart(lower, term);
  if (i < 0) i = lower.indexOf(term);
  if (i < 0) return { hit: false, node: text };
  return {
    hit: true,
    node: (
      <>
        {text.slice(0, i)}
        <mark>{text.slice(i, i + term.length)}</mark>
        {text.slice(i + term.length)}
      </>
    ),
  };
}

export default function SearchBox({ clients, value, inputRef, onChange, onChoose, onClear }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const term = value.trim().toLowerCase(); // case-insensitive
  const ranked = useMemo(() => (term ? rankedMatches(clients, term) : []), [clients, term]);
  const suggestions = ranked.slice(0, MAX_SUGGESTIONS);
  const showPanel = open && !!term && clients.length > 0;
  const extra = ranked.length - suggestions.length;

  // Close the suggestions when clicking or tabbing somewhere else
  useEffect(() => {
    const away = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('focusin', away);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('focusin', away);
    };
  }, []);

  useEffect(() => {
    if (active >= 0) document.getElementById('suggest-' + active)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (client) => {
    setOpen(false);
    setActive(-1);
    onChoose(client);
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    setOpen(true);
    setActive(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showPanel) {
        if (term && clients.length) {
          setOpen(true);
          setActive(0);
        }
      } else {
        setActive(Math.min(active + 1, suggestions.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      if (showPanel) {
        e.preventDefault();
        setActive(Math.max(0, active - 1));
      }
    } else if (e.key === 'Enter') {
      // Enter opens the highlighted suggestion, or the top match if none is highlighted
      e.preventDefault();
      if (showPanel && active >= 0) {
        choose(suggestions[active]);
        return;
      }
      if (ranked[0]) choose(ranked[0]);
    } else if (e.key === 'Escape' && showPanel) {
      e.preventDefault(); // first Escape closes the suggestions; the next one clears the box as usual
      setOpen(false);
      setActive(-1);
    }
  };

  const handleClear = () => {
    setOpen(false);
    setActive(-1);
    onClear();
  };

  const footText = !ranked.length
    ? `No clients match "${value.trim()}".`
    : extra > 0
      ? `${extra} more ${extra === 1 ? 'match' : 'matches'}. Keep typing to narrow the list.`
      : '';

  return (
    <div className="field">
      <label htmlFor="clientSearch">Search clients</label>
      <div className="input-wrap" ref={wrapRef}>
        <input
          type="search"
          id="clientSearch"
          ref={inputRef}
          value={value}
          placeholder="Type a name or email..."
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls="suggestList"
          aria-activedescendant={showPanel && active >= 0 ? 'suggest-' + active : undefined}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="clear-btn"
          aria-label="Clear search"
          title="Clear search"
          hidden={!value}
          onClick={handleClear}
        >
          <CloseIcon />
        </button>
        <div className="suggest" hidden={!showPanel}>
          <ul id="suggestList" role="listbox" aria-label="Matching clients">
            {showPanel &&
              suggestions.map((c, i) => {
                const name = highlight(c.name, term);
                const email = name.hit ? { node: c.email } : highlight(c.email, term); // email is shown on the next line
                return (
                  <li
                    key={c.key}
                    id={'suggest-' + i}
                    className={'suggest-item' + (i === active ? ' active' : '')}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()} // keep focus in the search box
                    onClick={() => choose(c)}
                  >
                    <span className="sg-name">{name.node}</span>
                    <span className="sg-email">{email.node}</span>
                  </li>
                );
              })}
          </ul>
          <div className="suggest-foot" hidden={!footText}>{footText}</div>
        </div>
      </div>
    </div>
  );
}
