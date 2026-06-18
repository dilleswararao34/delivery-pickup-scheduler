import React from 'react';
import './shared.css';

export function SkeletonRow() {
  return (
    <div className="skeleton-row" aria-hidden="true" role="presentation">
      <div className="skeleton skeleton-circle" />
      <div className="skeleton-col">
        <div className="skeleton skeleton-line medium" />
        <div className="skeleton skeleton-line short" />
      </div>
      <div className="skeleton-col">
        <div className="skeleton skeleton-line full" />
        <div className="skeleton skeleton-line medium" />
      </div>
      <div className="skeleton skeleton-badge" />
      <div className="skeleton-col" style={{ maxWidth: 100 }}>
        <div className="skeleton skeleton-line full" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ rows = 5 }) {
  return (
    <div role="status" aria-label="Loading bookings…">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div
      className="card"
      style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}
      aria-hidden="true"
    >
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <div className="skeleton skeleton-badge" style={{ width: 60, height: 20 }} />
        <div className="skeleton skeleton-line medium" style={{ height: 20 }} />
      </div>
      <div className="skeleton skeleton-line full" style={{ height: 14, marginBottom: 8 }} />
      <div className="skeleton skeleton-line medium" style={{ height: 14 }} />
    </div>
  );
}

export function SkeletonFlyout() {
  return (
    <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }} aria-hidden="true">
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
        <div className="skeleton skeleton-circle" style={{ width: 48, height: 48 }} />
        <div className="skeleton-col">
          <div className="skeleton skeleton-line short" style={{ height: 20, marginBottom: 8 }} />
          <div className="skeleton skeleton-badge" />
        </div>
      </div>
      {[1,2,3,4].map((i) => (
        <div key={i}>
          <div className="skeleton skeleton-line short" style={{ height: 10, marginBottom: 10 }} />
          <div className="skeleton skeleton-line full" style={{ height: 14 }} />
        </div>
      ))}
    </div>
  );
}
