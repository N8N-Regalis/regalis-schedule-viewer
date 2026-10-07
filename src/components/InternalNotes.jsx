import { useCallback, useEffect, useState } from 'react';
import {
  CONFLICT_CODE,
  fetchInternalNotes,
  fetchNotesHistory,
  saveInternalNotes,
} from '../lib/internalNotes.js';

const MAX_LENGTH = 10000;

const fmt = (iso) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

// Staff-only notes for one client, with an edit history. Remount per client (key={client.key}).
export default function InternalNotes({ email }) {
  const [saved, setSaved] = useState(null);   // { internal_notes, updated_at, updated_by } or null
  const [history, setHistory] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false); // editing stays off until a load succeeds

  // Loads the latest note + history; `keepDraft` leaves the textarea alone (used after a save clash)
  const load = useCallback(async (isCurrent = () => true, keepDraft = false) => {
    try {
      const [note, log] = await Promise.all([fetchInternalNotes(email), fetchNotesHistory(email)]);
      if (!isCurrent()) return;
      setSaved(note);
      setHistory(log);
      if (!keepDraft) setDraft(note ? note.internal_notes : '');
      setError('');
      setLoadFailed(false);
    } catch (err) {
      if (!isCurrent()) return;
      console.error(err);
      setLoadFailed(true);
      setError('Could not load internal notes: ' + err.message);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    let current = true;
    load(() => current);
    return () => { current = false; };
  }, [load]);

  const original = saved ? saved.internal_notes : '';
  const dirty = draft.trim() !== original;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await saveInternalNotes(email, draft, saved ? saved.updated_at : null);
      await load();
    } catch (err) {
      if (err.code === CONFLICT_CODE) {
        setError(err.message + '. The latest version and history are shown below; your text is kept. Copy it, then reload the note.');
        await load(undefined, true);
      } else {
        console.error(err);
        setError('Could not save: ' + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setDraft(original);
    setError('');
  };

  return (
    <div className="notes-block internal">
      <h3>
        Internal notes <span className="internal-tag">Regalis staff only</span>
      </h3>
      <textarea
        className="internal-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={MAX_LENGTH}
        rows={5}
        placeholder={loading ? 'Loading...' : 'Add internal notes about this client...'}
        disabled={loading || loadFailed}
        aria-label="Internal notes"
      />
      <div className="internal-actions">
        <button type="button" onClick={save} disabled={!dirty || saving || loading || loadFailed}>
          {saving ? 'Saving...' : 'Save notes'}
        </button>
        <button type="button" onClick={revert} disabled={!dirty || saving}>Discard changes</button>
        <span className="internal-meta">
          {saved ? `Last edited by ${saved.updated_by} on ${fmt(saved.updated_at)}` : loading ? '' : 'No internal notes yet.'}
        </span>
      </div>
      {error && <div className="internal-error" role="alert">{error}</div>}

      <button
        type="button"
        className="history-toggle"
        aria-expanded={showHistory}
        onClick={() => setShowHistory((v) => !v)}
      >
        {showHistory ? 'Hide' : 'Show'} history ({history.length})
      </button>
      {showHistory && (
        history.length ? (
          <ol className="history-list">
            {history.map((h) => (
              <li key={h.id}>
                <div className="history-head">
                  <b>{h.edited_by}</b>
                  <span>{fmt(h.changed_at)}</span>
                </div>
                <div className="history-kind">
                  {h.old_notes === null ? 'Added notes' : h.new_notes === '' ? 'Cleared notes' : 'Edited notes'}
                </div>
                {h.old_notes !== null && h.old_notes !== '' && (
                  <div className="history-text before"><small>Before</small>{h.old_notes}</div>
                )}
                {h.new_notes !== '' && (
                  <div className="history-text after"><small>After</small>{h.new_notes}</div>
                )}
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
