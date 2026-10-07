import { supabase } from './supabase.js';

// Staff edits to a client's schedule and special instructions; see supabase-schedule-edit-setup.sql.
// Writes go through database functions that record the editor's email and a history row themselves.
// Each save sends the value that was loaded; if it changed since, the database refuses (CONFLICT_CODE).

export { CONFLICT_CODE } from './internalNotes.js';

// Change log for one field ('slots' or 'notes'), newest first:
// [{ id, edited_by, field, old_value, new_value, timezone, changed_at }]
export async function fetchScheduleHistory(email, field) {
  const { data, error } = await supabase
    .from('schedule_history')
    .select('id, edited_by, field, old_value, new_value, timezone, changed_at')
    .eq('user_email', email.toLowerCase())
    .eq('field', field)
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return data || [];
}

// `slots` is the full new set in the schedule's existing shape; `expectedSlots` is what was loaded
// (null if the client had no schedule). `timezone` only applies to a client with no timezone and no slots.
export async function saveClientSlots(email, slots, expectedSlots, timezone) {
  const { error } = await supabase.rpc('save_client_slots', {
    p_user_email: email,
    p_slots: slots,
    p_expected_slots: expectedSlots,
    p_timezone: timezone,
  });
  if (error) throw error;
}

export async function saveClientNotes(email, notes, expectedNotes) {
  const { error } = await supabase.rpc('save_client_notes', {
    p_user_email: email,
    p_notes: notes,
    p_expected_notes: expectedNotes,
  });
  if (error) throw error;
}
