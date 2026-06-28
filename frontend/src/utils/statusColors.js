// Status → visual config mapping (light theme)

export const STATUS_CONFIG = {
  DRAFT: {
    label: 'Draft',
    bg:     '#f4f3f0',
    color:  '#6b6560',
    border: '#d4d0c8',
    dot:    '#a8a39c',
    icon:   '○',
  },
  QUOTATION_REQUESTED: {
    label: 'Quote Requested',
    bg:     '#fef3c7',
    color:  '#92400e',
    border: '#fde68a',
    dot:    '#d97706',
    icon:   '◎',
  },
  CONFIRMED: {
    label: 'Confirmed',
    bg:     '#eff6ff',
    color:  '#1e40af',
    border: '#bfdbfe',
    dot:    '#2563eb',
    icon:   '●',
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for Delivery',
    bg:     '#fff7ed',
    color:  '#9a3412',
    border: '#fed7aa',
    dot:    '#c45a0a',
    icon:   '▶',
  },
  DELIVERED: {
    label: 'Delivered',
    bg:     '#f0fdf4',
    color:  '#14532d',
    border: '#bbf7d0',
    dot:    '#16a34a',
    icon:   '✓',
  },
  AWAITING_PICKUP: {
    label: 'Awaiting Pickup',
    bg:     '#fffbeb',
    color:  '#78350f',
    border: '#fde68a',
    dot:    '#b45309',
    icon:   '◷',
  },
  PICKED_UP_AND_RETURNED: {
    label: 'Returned',
    bg:     '#f0fdf4',
    color:  '#14532d',
    border: '#bbf7d0',
    dot:    '#16a34a',
    icon:   '↩',
  },
  ARCHIVED: {
    label: 'Archived',
    bg:     '#f9f9f7',
    color:  '#a8a39c',
    border: '#e0ddd6',
    dot:    '#c4c0b8',
    icon:   '▣',
  },
  CANCELLATION_REQUESTED: {
    label: 'Cancellation Requested',
    bg:     '#fef2f2',
    color:  '#991b1b',
    border: '#fee2e2',
    dot:    '#ef4444',
    icon:   '✖',
  },
};

export const PRIORITY_CONFIG = {
  CRITICAL: { color: '#c43030', bg: 'rgba(196,48,48,0.08)',   label: 'Critical' },
  HIGH:     { color: '#b45309', bg: 'rgba(180,83,9,0.08)',    label: 'High'     },
  MEDIUM:   { color: '#2a62c8', bg: 'rgba(42,98,200,0.07)',   label: 'Medium'   },
  LOW:      { color: '#6b6560', bg: 'rgba(107,101,96,0.06)',  label: 'Low'      },
};

export const EQUIPMENT_STATUS_CONFIG = {
  AVAILABLE:      { color: '#14532d', bg: '#f0fdf4',  label: 'Available'   },
  RESERVED:       { color: '#78350f', bg: '#fffbeb',  label: 'Reserved'    },
  OUT_ON_HIRE:    { color: '#9a3412', bg: '#fff7ed',  label: 'On Hire'     },
  IN_MAINTENANCE: { color: '#c43030', bg: '#fef2f2',  label: 'Maintenance' },
  RETIRED:        { color: '#6b6560', bg: '#f4f3f0',  label: 'Retired'     },
};

export const ALLOWED_TRANSITIONS = {
  DRAFT:                  ['QUOTATION_REQUESTED', 'ARCHIVED', 'CANCELLATION_REQUESTED'],
  QUOTATION_REQUESTED:    ['CONFIRMED', 'DRAFT', 'ARCHIVED', 'CANCELLATION_REQUESTED'],
  CONFIRMED:              ['OUT_FOR_DELIVERY', 'ARCHIVED', 'CANCELLATION_REQUESTED'],
  OUT_FOR_DELIVERY:       ['DELIVERED'],
  DELIVERED:              ['AWAITING_PICKUP'],
  AWAITING_PICKUP:        ['PICKED_UP_AND_RETURNED'],
  PICKED_UP_AND_RETURNED: ['ARCHIVED'],
  CANCELLATION_REQUESTED: ['ARCHIVED', 'CONFIRMED', 'DRAFT'],
  ARCHIVED:               [],
};
