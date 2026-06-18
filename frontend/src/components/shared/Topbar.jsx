import React, { useState, useEffect } from 'react';
import './shared.css';

const OPERATORS = [
  { name: 'Dilleswara Rao', initials: 'DR', role: 'Ops Manager' },
];

export default function Topbar({ alertCount = 0, bookingCount = 0, onAlertClick }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const op = OPERATORS[0];

  const formattedTime = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day:     '2-digit',
    month:   'short',
    hour:    '2-digit',
    minute:  '2-digit',
    hour12:  true,
  }).format(time);

  return (
    <header className="topbar" role="banner">
      {/* Live stats */}
      <div className="topbar__center">
        <div className="topbar__stat" title="Active bookings in the system">
          <span className="topbar__stat-dot" aria-hidden="true" />
          <span className="topbar__stat-label">Active Bookings</span>
          <span className="topbar__stat-value">{bookingCount}</span>
        </div>
        <div className="topbar__stat" title="Current time">
          <span className="topbar__stat-label">🕐</span>
          <span className="topbar__stat-value" style={{ color: 'var(--text-secondary)' }}>
            {formattedTime}
          </span>
        </div>
      </div>

      {/* Right controls */}
      <div className="topbar__right">
        <button
          id="topbar-alert-btn"
          className="topbar__alert-btn"
          onClick={onAlertClick}
          title={`${alertCount} system alert${alertCount !== 1 ? 's' : ''}`}
          aria-label={`View system alerts (${alertCount} active)`}
        >
          🔔
          {alertCount > 0 && (
            <span className="topbar__alert-badge" aria-hidden="true">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>

        <div className="topbar__operator" title={`Logged in as ${op.name}`} role="button" tabIndex={0}>
          <div className="topbar__avatar" aria-hidden="true">{op.initials}</div>
          <span className="topbar__op-name">{op.name}</span>
        </div>
      </div>
    </header>
  );
}
