import { supabase } from './supabase.js';

export const ALLOWED_DOMAIN = 'regaliscapital.com';

// Exact domain match; "x@regaliscapital.com.evil.com" and "x@evilregaliscapital.com" are rejected.
export function isAllowedEmail(email) {
  return (email || '').trim().toLowerCase().endsWith('@' + ALLOWED_DOMAIN);
}

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Return to the exact page (including the GitHub Pages sub-path)
      redirectTo: window.location.origin + window.location.pathname,
      // `hd` only pre-filters Google's account picker; it is a hint, not a security control
      queryParams: { hd: ALLOWED_DOMAIN, prompt: 'select_account' },
    },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}
