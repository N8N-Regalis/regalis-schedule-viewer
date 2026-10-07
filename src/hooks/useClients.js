import { useCallback, useEffect, useState } from 'react';
import { fetchClients } from '../lib/clients.js';

// Loads the merged client list once on mount and again whenever `reload` is called.
// `reload({ silent: true })` refreshes the data without switching the page into its loading state.
export function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastLoaded, setLastLoaded] = useState('');

  const reload = useCallback(async (options) => {
    const silent = options && options.silent === true; // not just truthy: onClick passes an event
    if (!silent) setLoading(true);
    try {
      const list = await fetchClients();
      setClients(list);
      setError('');
      setLastLoaded(
        'Loaded ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      );
    } catch (err) {
      console.error(err);
      setError(
        err.message + '. Check that the Supabase project is active and that the anon role can read both tables.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { clients, loading, error, lastLoaded, reload };
}
