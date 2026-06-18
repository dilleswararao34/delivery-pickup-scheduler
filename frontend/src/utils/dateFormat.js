// Date/time formatting utilities

export function formatDate(iso, opts = {}) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
    ...opts,
  }).format(new Date(iso));
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

export function formatTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

export function formatRelative(iso) {
  if (!iso) return '—';
  const now   = Date.now();
  const then  = new Date(iso).getTime();
  const diff  = now - then;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return formatDate(iso);
}

export function getDurationDays(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.ceil(ms / 86400000);
}

export function isOverdue(returnDate) {
  if (!returnDate) return false;
  return new Date(returnDate) < new Date();
}

export function isDueSoon(deliveryDate, hoursThreshold = 48) {
  if (!deliveryDate) return false;
  const diff = new Date(deliveryDate).getTime() - Date.now();
  return diff > 0 && diff < hoursThreshold * 3600000;
}

export function formatCurrency(value) {
  if (value === null || value === undefined) return '₹0.00';
  const num = parseFloat(value);
  return '₹' + (isNaN(num) ? '0.00' : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}
