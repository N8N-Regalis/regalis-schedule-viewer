import logo from '../assets/logo.png';

export default function Header({ status, lastLoaded, loading, onRefresh }) {
  return (
    <header>
      <div className="brand-container">
        <img src={logo} alt="Regalis Capital Logo" className="brand-logo" />
        <div className="header-text">
          <div className="brand-title">REGALIS CAPITAL</div>
          <div className="eyebrow" style={{ marginTop: 4 }}>Internal Schedule Viewer</div>
          <h1>Client Availability</h1>
          <p>Choose a client to see every date and time they marked as available, plus their special instructions.</p>
        </div>
      </div>
      <div className="header-actions">
        <div className="status">
          <strong>{status}</strong>
          <span>{lastLoaded || ' '}</span>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading}>Refresh data</button>
      </div>
    </header>
  );
}
