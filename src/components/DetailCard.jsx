import { useMemo } from 'react';
import { formatHours, groupByDate, tzLabel } from '../lib/time.js';
import InternalNotes from './InternalNotes.jsx';
import SpecialInstructions from './SpecialInstructions.jsx';

export default function DetailCard({ client, onSaved }) {
  return (
    <aside className="card">
      {client ? <Details client={client} onSaved={onSaved} /> : (
        <div>
          <h2>Client details</h2>
          <p>Contact info, totals and special instructions appear here.</p>
        </div>
      )}
    </aside>
  );
}

function Details({ client, onSaved }) {
  const sched = client.schedule;
  const days = useMemo(() => groupByDate(sched), [sched]);
  const slotCount = days.reduce((n, d) => n + d.mins.length, 0);
  const tz = sched && sched.timezone ? sched.timezone : '';

  const updated = sched && sched.updated_at
    ? new Date(sched.updated_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : 'Never';

  return (
    <div>
      <p className="detail-name">{client.name}</p>
      <div className="detail-email">{client.email}</div>
      <dl className="facts">
        <dt>Client's Timezone</dt><dd>{tzLabel(tz)}</dd>
        <dt>Available dates</dt><dd>{days.length}</dd>
        <dt>Selected slots</dt><dd>{slotCount}</dd>
        <dt>Total hours</dt><dd>{slotCount ? formatHours(slotCount) : '0'}</dd>
        <dt>Last saved</dt><dd>{updated}</dd>
      </dl>
      <SpecialInstructions key={'si-' + client.key} client={client} onSaved={onSaved} />
      <InternalNotes key={client.key} email={client.email} />
    </div>
  );
}
