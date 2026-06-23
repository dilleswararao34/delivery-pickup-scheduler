import React from 'react';
import { motion } from 'framer-motion';
import { formatRelative } from '../../utils/dateFormat.js';
import { alertEntrance } from '../../utils/motionVariants.js';
import './OpsAssistant.css';

export default function AlertCard({ alert, onDismiss }) {
  const { alert_id, id, priority, trigger_type, message, created_at } = alert;
  const alertId = alert_id || id;

  const PRIORITY_COLORS = {
    CRITICAL: 'var(--red, #e06c75)',
    HIGH:     'var(--orange, #d19a66)',
    MEDIUM:   'var(--blue, #61afef)',
    LOW:      'var(--graphite, #abb2bf)',
  };

  return (
    <motion.div
      id={`alert-card-${alertId}`}
      className={`alert-card alert-card--${priority}`}
      role="alert"
      aria-live="polite"
      variants={alertEntrance}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      <div className="alert-card__header">
        <span className="alert-card__priority" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            className="alert-card__dot"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: PRIORITY_COLORS[priority] || 'var(--text-secondary)',
              display: 'inline-block'
            }}
          />
          {priority}
        </span>
        {onDismiss && (
          <button
            className="alert-card__dismiss"
            onClick={(e) => { e.stopPropagation(); onDismiss(alertId); }}
            aria-label={`Dismiss ${priority} alert`}
            title="Dismiss this alert"
          >
            ✕
          </button>
        )}
      </div>

      <div className="alert-card__trigger">{trigger_type?.replace(/_/g, ' ')}</div>
      <p className="alert-card__message">{message}</p>
      <div className="alert-card__time">{formatRelative(created_at)}</div>
    </motion.div>
  );
}
