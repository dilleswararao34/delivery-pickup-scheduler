import React from 'react';
import './shared.css';

const ICONS = {
  bookings: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="2.5" />
      <line x1="20" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="20" y1="32" x2="44" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="20" y1="40" x2="36" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 8h12M44 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 8L56 52H8L32 8Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
      <line x1="32" y1="28" x2="32" y2="40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="32" cy="46" r="1.5" fill="currentColor"/>
    </svg>
  ),
  search: (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="28" r="16" stroke="currentColor" strokeWidth="2.5"/>
      <line x1="40" y1="40" x2="56" y2="56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
};

export default function EmptyState({ type = 'bookings', title, subtitle, action, actionLabel }) {
  return (
    <div className="empty-state animate-in" role="status" aria-live="polite">
      <div className="empty-state__icon" style={{ color: 'var(--text-tertiary)' }}>
        {ICONS[type] || ICONS.bookings}
      </div>
      <h3 className="empty-state__title">{title || 'Nothing here yet'}</h3>
      <p className="empty-state__subtitle">
        {subtitle || 'No records match your current filters. Try adjusting your search.'}
      </p>
      {action && (
        <button id="empty-state-action-btn" className="btn btn-primary" onClick={action}>
          {actionLabel || 'Create New'}
        </button>
      )}
    </div>
  );
}
