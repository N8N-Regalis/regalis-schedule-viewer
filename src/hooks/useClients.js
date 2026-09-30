import { useCallback, useEffect, useState } from 'react';
import { fetchClients } from '../lib/clients.js';

// Loads the merged client list once on mount and again whenever `reload` is called.
export function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastLoaded, setLastLoaded] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
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
