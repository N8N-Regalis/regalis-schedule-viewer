import { useState } from 'react';
import logo from '../assets/logo.png';
import { ALLOWED_DOMAIN, signInWithGoogle } from '../lib/auth.js';

export default function LoginScreen({ rejected }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setBusy(true);
    setError('');
    const { error: err } = await signInWithGoogle();
    if (err) {
      setError(err.message);
      setBusy(false);
    } // on success the browser is redirected to Google
  };

  return (
    <main>
      <section className="card login">
        <img src={logo} alt="Regalis Capital Logo" className="brand-logo" />
        <div className="brand-title">REGALIS CAPITAL</div>
        <h1>Client Availability</h1>
        <p>Sign in with your @{ALLOWED_DOMAIN} Google account to continue.</p>
        {rejected && (
          <div className="login-error" role="alert">
            {rejected} is not a @{ALLOWED_DOMAIN} account. Please sign in with your Regalis email.
          </div>
        )}
        {error && <div className="login-error" role="alert">{error}</div>}
        <button type="button" onClick={handleSignIn} disabled={busy}>
          {busy ? 'Redirecting...' : 'Sign in with Google'}
        </button>
      </section>
    </main>
  );
}
