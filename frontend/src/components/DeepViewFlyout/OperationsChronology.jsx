import React from 'react';
import StatusBadge from '../LiveLogisticsGrid/StatusBadge.jsx';
import { formatDateTime, formatDate } from '../../utils/dateFormat.js';
import './DeepViewFlyout.css';

export function OperationsChronology({ history }) {
  if (!history || history.length === 0) {
    return <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No status history recorded yet.</p>;
  }

  return (
    <ul className="flyout-timeline" aria-label="Booking status history">
      {[...history].reverse().map((entry, i) => (
        <li key={i} className={`flyout-timeline__item${i === 0 ? ' flyout-timeline__item--latest' : ''}`}>
          <div className="flyout-timeline__arrow">
            {entry.from_status ? (
              <span>
                <StatusBadge status={entry.from_status} size="sm" />
                <span style={{ margin: '0 6px', color: 'var(--text-tertiary)' }}>→</span>
              </span>
            ) : null}
            <StatusBadge status={entry.to_status} size="sm" />
          </div>
          <div className="flyout-timeline__meta">
            by <strong style={{ color: 'var(--text-primary)' }}>{entry.changed_by}</strong>
            {' · '}
            {formatDateTime(entry.changed_at)}
          </div>
          {entry.reason && (
            <div className="flyout-timeline__reason">"{entry.reason}"</div>
          )}
        </li>
      ))}
    </ul>
  );
}
