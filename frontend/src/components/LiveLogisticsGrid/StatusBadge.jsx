import React from 'react';
import { STATUS_CONFIG } from '../../utils/statusColors.js';

export default function StatusBadge({ status, size = 'md' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const isLive = status === 'OUT_FOR_DELIVERY';

  return (
    <span
      className={`status-badge status-badge--${size}`}
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             '5px',
        padding:         size === 'sm' ? '2px 7px' : size === 'lg' ? '5px 12px' : '3px 9px',
        background:      config.bg,
        color:           config.color,
        border:          `1px solid ${config.border}`,
        borderRadius:    'var(--radius-full)',
        fontSize:        size === 'sm' ? 'var(--text-xs)' : size === 'lg' ? 'var(--text-md)' : 'var(--text-sm)',
        fontWeight:      500,
        whiteSpace:      'nowrap',
        letterSpacing:   '0.01em',
        transition:      'var(--transition)',
      }}
      title={`Status: ${config.label}`}
    >
      <span
        style={{
          width:        '6px',
          height:       '6px',
          borderRadius: '50%',
          background:   config.dot,
          flexShrink:   0,
          animation:    isLive ? 'pulse-dot 1.5s ease infinite' : 'none',
        }}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}
