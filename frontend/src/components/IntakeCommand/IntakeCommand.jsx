import React, { useState, useRef } from 'react';
import BookingForm from './BookingForm.jsx';
import './IntakeCommand.css';

const MODES = [
  { id: 'booking', label: '📋 New Booking',    desc: 'Full equipment hire booking intake' },
  { id: 'quote',   label: '💬 Quotation',       desc: 'Request price quotation for client' },
  { id: 'damage',  label: '⚠ Damage Report',    desc: 'Log equipment damage on return'    },
];

export default function IntakeCommand({ equipment, onBookingCreate }) {
  const [mode, setMode] = useState('booking');
  const formRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      const result = await onBookingCreate(payload);
      return result;
    } finally {
      setSubmitting(false);
    }
  };

  const triggerSubmit = () => {
    // Trigger form submit from parent button
    const form = document.getElementById('booking-intake-form');
    if (form) form.requestSubmit();
  };

  return (
    <section className="intake card" aria-label="Intake Command System">
      {/* Header */}
      <div className="intake__header">
        <div className="intake__title-row">
          <h2 className="intake__title">Intake Command</h2>
        </div>

        {/* Mode tabs */}
        <div className="intake__mode-tabs" role="tablist" aria-label="Select intake mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              id={`intake-mode-tab-${m.id}`}
              aria-selected={mode === m.id}
              data-mode={m.id}
              className={`intake__mode-tab${mode === m.id ? ' intake__mode-tab--active' : ''}`}
              onClick={() => setMode(m.id)}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="intake__body">
        {mode === 'booking' && (
          <BookingForm equipment={equipment} onSubmit={handleSubmit} mode="booking" />
        )}

        {mode === 'quote' && (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 'var(--space-4)' }}>💬</div>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--amber)', marginBottom: 'var(--space-3)' }}>
              Quotation Mode
            </h3>
            <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-secondary)', maxWidth: 280, margin: '0 auto var(--space-5)' }}>
              Generate a formal quotation for a client. Select equipment and date range to compute rental rates.
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              Create a booking in Draft mode first, then advance to Quotation Requested via the status workflow.
            </p>
          </div>
        )}

        {mode === 'damage' && (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 'var(--space-4)' }}>⚠</div>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--red)', marginBottom: 'var(--space-3)' }}>
              Damage Report
            </h3>
            <p style={{ fontSize: 'var(--text-md)', color: 'var(--text-secondary)', maxWidth: 280, margin: '0 auto var(--space-5)' }}>
              Log equipment damage discovered upon return. The report is linked to the booking and customer record.
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              Open a booking from the grid and use the "Log Damage" action in the Deep View panel.
            </p>
          </div>
        )}
      </div>

      {/* Footer with submit */}
      {mode === 'booking' && (
        <div className="intake__footer">
          <span className="intake__footer-hint">Fields marked * are required</span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              id="intake-reset-btn"
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const form = document.getElementById('booking-intake-form');
                if (form) form.reset?.();
                window.location.reload(); // Lightweight reset for mock
              }}
            >
              Reset
            </button>
            <button
              id="intake-submit-btn"
              type="button"
              className="btn btn-primary"
              onClick={triggerSubmit}
              disabled={submitting}
            >
              {submitting ? '⟳ Saving…' : '+ Create Booking'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
