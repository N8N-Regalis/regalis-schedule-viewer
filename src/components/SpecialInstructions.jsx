import { useState } from 'react';
import { CONFLICT_CODE, saveClientNotes } from '../lib/scheduleEdits.js';
import ScheduleHistory from './ScheduleHistory.jsx';

const MAX_LENGTH = 10000;

// The client's special instructions, editable by Regalis staff, with an edit history.
// Remount per client (key={client.key}). `onSaved` refreshes the client data after a save.
export default function SpecialInstructions({ client, onSaved }) {
  const sched = client.schedule;
  const notes = sched && sched.notes ? sched.notes.trim() : '';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [base, setBase] = useState(null);       // notes value loaded when editing began, checked on save
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');

  const startEdit = () => {
    setBase(sched && sched.notes != null ? sched.notes : null);
    setDraft(notes);
    setConflict(false);
    setError('');
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await saveClientNotes(client.email, draft, base);
      await onSaved();
      setEditing(false);
    } catch (err) {
      if (err.code === CONFLICT_CODE) {
        setConflict(true);
        setError(err.message + '. Nothing was saved and your text is kept here. Copy it, then Cancel and edit the latest version (see the history below).');
        onSaved();
      } else {
        console.error(err);
        setError('Could not save: ' + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const dirty = draft.trim() !== (base == null ? '' : base.trim());

  return (
    <div className="notes-block">
      <div className="block-head">
        <h3>Special instructions</h3>
        {!editing && <button type="button" onClick={startEdit}>Edit</button>}
      </div>

      {editing ? (
        <>
          <textarea
            className="internal-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={5}
            disabled={saving}
            placeholder="Add special instructions for this client..."
            aria-label="Special instructions"
          />
          <div className="internal-actions">
            <button type="button" onClick={save} disabled={!dirty || saving || conflict}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={cancel} disabled={saving}>Cancel</button>
          </div>
        </>
      ) : (
        <div className={'notes' + (notes ? '' : ' empty')}>{notes || 'No special instructions.'}</div>
      )}
      {error && <div className="internal-error" role="alert">{error}</div>}

      <ScheduleHistory
        email={client.email}
        field="notes"
        refreshKey={sched ? sched.updated_at : ''}
      />
    </div>
  );
}
