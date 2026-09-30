import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { isAllowedEmail, signOut } from '../lib/auth.js';

// Tracks the Supabase session. Returns:
//   loading  - true until the stored session (or OAuth redirect) has been resolved
//   user     - the signed-in user, only if their email is on the allowed domain
//   rejected - the email of a signed-in account that was on the wrong domain (already signed out)
export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [rejected, setRejected] = useState('');

  useEffect(() => {
    const apply = (session) => {
      const u = session?.user;
      if (u && !isAllowedEmail(u.email)) {
        setRejected(u.email || 'that account');
        setUser(null);
        signOut(); // drop the session so the wrong-domain token is not kept
      } else {
        if (u) setRejected('');
        setUser(u || null);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { loading, user, rejected };
}
