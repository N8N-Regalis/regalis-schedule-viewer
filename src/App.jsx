import { useEffect, useMemo, useRef, useState } from 'react';
import logo from './assets/logo.png';
import Header from './components/Header.jsx';
import SearchBox from './components/SearchBox.jsx';
import ClientCombo from './components/ClientCombo.jsx';
import ScheduleCard from './components/ScheduleCard.jsx';
import DetailCard from './components/DetailCard.jsx';
import Roster from './components/Roster.jsx';
import { useClients } from './hooks/useClients.js';
import { useStarred } from './hooks/useStarred.js';
import LoginScreen from './components/LoginScreen.jsx';
import { useAuth } from './hooks/useAuth.js';
import { signOut } from './lib/auth.js';
import { matchesSearch } from './lib/clients.js';

// Only signed-in @regaliscapital.com users get the viewer; data is not fetched before that.
export default function App() {
  const { loading, user, rejected } = useAuth();
  if (loading) return null;
  if (!user) return <LoginScreen rejected={rejected} />;
  return <Viewer user={user} />;
}

function Viewer({ user }) {
  const { clients, loading, error, lastLoaded, reload } = useClients();
  const { starred, toggleStar } = useStarred();
  const [selectedKey, setSelectedKey] = useState('');
  const [search, setSearch] = useState('');
  const searchInputRef = useRef(null);

  // Use the header logo as the blurred page background
  useEffect(() => {
    document.documentElement.style.setProperty('--logo-url', `url("${logo}")`);
  }, []);

  const term = search.trim().toLowerCase(); // case-insensitive
  const matches = useMemo(() => clients.filter((c) => matchesSearch(c, term)), [clients, term]);
  const selected = clients.find((c) => c.key === selectedKey);

  // Names that appear more than once get their email shown so they can be told apart
  const nameCounts = useMemo(() => {
    const counts = {};
    clients.forEach((c) => {
      const n = c.name.toLowerCase();
      counts[n] = (counts[n] || 0) + 1;
    });
    return counts;
  }, [clients]);

  const withSchedule = useMemo(() => clients.filter((c) => c.hasSlots).length, [clients]);
  const status = loading ? 'Loading clients...'
    : error ? 'Load failed'
    : `${clients.length} clients, ${withSchedule} with schedules`;

  const handleSearchChange = (value) => {
    setSearch(value);
    // Typing a search that leaves exactly one client picks that client
    const t = value.trim().toLowerCase();
    if (t) {
      const hits = clients.filter((c) => matchesSearch(c, t));
      if (hits.length === 1) setSelectedKey(hits[0].key);
    }
  };

  const chooseFromSearch = (client) => {
    setSearch(client.name);
    setSelectedKey(client.key);
  };

  const clearSearch = () => {
    setSearch('');
    searchInputRef.current?.focus();
  };

  return (
    <main>
      <Header
        status={status}
        lastLoaded={lastLoaded}
        loading={loading}
        onRefresh={reload}
        userEmail={user.email}
        onSignOut={signOut}
      />

      {/* Client picker */}
      <section className="card picker" aria-label="Find a client">
        <SearchBox
          clients={clients}
          value={search}
          inputRef={searchInputRef}
          onChange={handleSearchChange}
          onChoose={chooseFromSearch}
          onClear={clearSearch}
        />
        <ClientCombo
          clients={clients}
          matches={matches}
          nameCounts={nameCounts}
          starred={starred}
          selectedKey={selectedKey}
          loading={loading}
          onSelect={setSelectedKey}
          onClearSelection={() => setSelectedKey('')}
          onToggleStar={toggleStar}
        />
        <div className="count" aria-live="polite">
          {term ? `${matches.length} of ${clients.length} match` : `${clients.length} clients`}
        </div>
      </section>

      <div className="app-layout">
        {/* Left: availability list */}
        <ScheduleCard client={selected} error={error} />

        {/* Right: client details, then the roster */}
        <div className="side-col">
          <DetailCard client={selected} />
          <Roster
            clients={clients}
            term={term}
            rawTerm={search.trim()}
            starred={starred}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            onClearSearch={clearSearch}
          />
        </div>
      </div>
    </main>
  );
}
