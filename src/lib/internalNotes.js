import { supabase } from './supabase.js';

// Staff-only tables; see supabase-internal-notes-setup.sql. Rows are keyed by the client's lowercase email.

export const CONFLICT_CODE = '40001'; // someone else saved first

// Current note for a client: { internal_notes, updated_at, updated_by } or null if none saved yet
export async function fetchInternalNotes(email) {
  const { data, error } = await supabase
    .from('client_internal_notes')
    .select('internal_notes, updated_at, updated_by')
    .eq('user_email', email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Edit log for a client, newest first: [{ id, edited_by, old_notes, new_notes, changed_at }]
export async function fetchNotesHistory(email) {
  const { data, error } = await supabase
    .from('internal_notes_history')
    .select('id, edited_by, old_notes, new_notes, changed_at')
    .eq('user_email', email.toLowerCase())
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Saves through the database function, which records the editor's email and the history entry itself.
// `expectedUpdatedAt` is the updated_at we loaded (null if no note existed), used to detect clashes.
export async function saveInternalNotes(email, notes, expectedUpdatedAt) {
  const { error } = await supabase.rpc('save_internal_notes', {
    p_user_email: email.toLowerCase(),
    p_notes: notes,
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (error) throw error;
}
